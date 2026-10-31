using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Reporting;

namespace Soopi.Api.Services.Identity;

public sealed class AuthService(
    AppDbContext db,
    AccountStore accounts,
    PrincipalDirectory principals,
    JwtService jwt,
    PasswordPolicy passwordPolicy,
    RateLimiter rateLimiter,
    AuditService audit,
    IOptions<SecurityOptions> options,
    SecurityVersionCache securityVersions,
    TransactionRunner transactions,
    TimeProvider clock,
    AccessTrackingService access)
{
    private SecurityOptions Settings => options.Value;

    /// <summary>Lỗi nghiệp vụ (sai mật khẩu, khóa tạm) vẫn ghi bộ đếm đăng nhập sai và nhật ký trước khi báo lỗi.</summary>
    public async Task<AuthResult> LoginAsync(string username, string password, bool remember, string? ip, string? userAgent)
    {
        var (account, displayName) = await AuthenticateAsync(username, password, ip, customerOnly: false);
        return await IssueAsync(account, displayName, remember, Guid.NewGuid().ToString(), ip, userAgent, login: true);
    }

    /// <summary>App di động: chỉ tài khoản khách hàng; phiên luôn "ghi nhớ" như ứng dụng thường làm.</summary>
    public async Task<AuthResult> LoginCustomerAsync(string username, string password, string? ip, string? userAgent)
    {
        var (account, displayName) = await AuthenticateAsync(username, password, ip, customerOnly: true);
        return await IssueAsync(account, displayName, true, Guid.NewGuid().ToString(), ip, userAgent, login: true);
    }

    /// <summary>Mở phiên cho tài khoản khách vừa đăng ký (đã xác minh OTP thay cho mật khẩu).</summary>
    public Task<AuthResult> SignInAsync(long accountId, string? ip, string? userAgent) =>
        transactions.InTransactionAsync(async () =>
        {
            var account = await RequireActiveAccountAsync(accountId);
            account.RegisterSuccessfulLogin(clock.GetUtcNow());
            await accounts.SaveAsync();
            return await IssueAsync(account, await principals.DisplayNameAsync(account), true, Guid.NewGuid().ToString(), ip, userAgent, login: true);
        });

    public async Task<AuthResult> RefreshAsync(string rawToken, string? ip, string? userAgent)
    {
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == Hash(rawToken))
            ?? throw new DomainException(ErrorCode.AUTH_TOKEN_INVALID);
        var now = clock.GetUtcNow();
        if (token.RevokedAt is not null)
        {
            await RevokeFamilyAsync(token.FamilyId, now);
            await access.EndAsync(token.AccountId, token.FamilyId, now);
            await AuditReuseAsync(token);
            throw new DomainException(ErrorCode.AUTH_REFRESH_REUSED);
        }
        if (!token.Active(now)) throw new DomainException(ErrorCode.AUTH_TOKEN_INVALID);
        return await transactions.InTransactionAsync(async () =>
        {
            var account = await RequireActiveAccountAsync(token.AccountId);
            var result = await IssueAsync(account, await principals.DisplayNameAsync(account), token.Remember, token.FamilyId, ip, userAgent);
            token.Rotate(now, Hash(result.RefreshToken));
            await db.SaveChangesAsync();
            return result;
        });
    }

    /// <summary>Trả về tài khoản của refresh token (nếu còn nhận ra) để app di động gỡ luôn thiết bị nhận push.</summary>
    public Task<long?> LogoutAsync(string? rawToken, bool all) => transactions.InTransactionAsync<long?>(async () =>
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return null;
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == Hash(rawToken));
        if (token is null) return null;
        var now = clock.GetUtcNow();
        await access.EndAsync(token.AccountId, all ? null : token.FamilyId, now);
        var active = db.RefreshTokens.Where(t => t.AccountId == token.AccountId && t.RevokedAt == null && t.ExpiresAt > now);
        var changed = await (all ? active : active.Where(t => t.FamilyId == token.FamilyId)).AnyAsync();
        if (all) await RevokeAccountAsync(token.AccountId, now);
        else
        {
            await RevokeFamilyAsync(token.FamilyId, now);
        }
        if (changed && await accounts.FindByIdAsync(token.AccountId) is { } account)
            await AuditAsync(account, all ? "AUTH_LOGOUT_ALL" : "AUTH_LOGOUT", all ? "Đăng xuất mọi thiết bị" : "Đăng xuất");
        return token.AccountId;
    });

    public async Task<UserView> MeAsync(AuthenticatedActor actor)
    {
        var account = await accounts.FindByIdAsync(actor.AccountId) ?? throw new DomainException(ErrorCode.AUTH_TOKEN_REVOKED);
        return View(account, actor.DisplayName ?? account.Username);
    }

    /// <summary><paramref name="remember"/>: phiên mới sau khi đổi mật khẩu có "ghi nhớ" hay không (app di động luôn có).</summary>
    public Task<AuthResult> ChangePasswordAsync(
        AuthenticatedActor actor, string currentPassword, string newPassword, bool remember, string? ip, string? userAgent) =>
        transactions.InTransactionAsync(() => ChangePasswordOnceAsync(actor, currentPassword, newPassword, remember, ip, userAgent));

    private async Task<AuthResult> ChangePasswordOnceAsync(
        AuthenticatedActor actor, string currentPassword, string newPassword, bool remember, string? ip, string? userAgent)
    {
        var account = await accounts.FindByIdAsync(actor.AccountId) ?? throw new DomainException(ErrorCode.AUTH_TOKEN_REVOKED);
        // Chặn dò "mật khẩu hiện tại" bằng token/phiên đánh cắp: giới hạn tần suất giống màn đăng nhập.
        rateLimiter.CheckLogin(ip, actor.Username);
        if (!PasswordHasher.Matches(currentPassword, account.PasswordHash)) throw new DomainException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        passwordPolicy.Validate(account.Username, newPassword);
        // Giữ nguyên mật khẩu (vd. mật khẩu mặc định sau khi đặt lại, D-076) không được tính là đã đổi.
        if (newPassword == currentPassword) throw new DomainException(ErrorCode.AUTH_PASSWORD_POLICY);
        var now = clock.GetUtcNow();
        account.ChangePassword(PasswordHasher.Encode(newPassword), now);
        await accounts.SaveAsync();
        securityVersions.Evict(account.Id);
        await RevokeAccountAsync(account.Id, now);
        await AuditAsync(account, "AUTH_PASSWORD_CHANGED", "Đổi mật khẩu");
        return await IssueAsync(account, actor.DisplayName ?? account.Username, remember, Guid.NewGuid().ToString(), ip, userAgent);
    }

    /// <summary>Quên mật khẩu (chủ tài khoản đã xác minh OTP): thu hồi mọi phiên; mật khẩu đã kiểm tra chính sách trước.</summary>
    public Task RecoverPasswordAsync(long accountId, string newPassword) =>
        transactions.InTransactionAsync(async () =>
        {
            var account = await accounts.FindByIdAsync(accountId) ?? throw new DomainException(ErrorCode.NOT_FOUND);
            var now = clock.GetUtcNow();
            account.RecoverPassword(PasswordHasher.Encode(newPassword), now);
            await accounts.SaveAsync();
            securityVersions.Evict(account.Id);
            await RevokeAccountAsync(account.Id, now);
            await AuditAsync(account, "AUTH_PASSWORD_RECOVERED", "Đặt lại mật khẩu bằng OTP");
        });

    public async Task RevokeAccountAsync(long accountId, DateTimeOffset at)
    {
        await db.RefreshTokens.Where(t => t.AccountId == accountId && t.RevokedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, at));
        await access.EndAsync(accountId, null, at);
    }

    public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static UserView View(Account account, string displayName)
    {
        var roles = account.Roles.Select(RoleView.From).ToList();
        var permissions = RolePermissions.ForRoles(account.Roles).Select(p => p.ToString()).Order(StringComparer.Ordinal).ToList();
        return new UserView(
            account.Id.ToString(),
            account.Username,
            displayName,
            account.EmployeeId,
            account.CustomerId,
            roles,
            permissions,
            roles[0].Landing,
            account.MustChangePassword);
    }

    private async Task<(Account Account, string DisplayName)> AuthenticateAsync(string username, string password, string? ip, bool customerOnly)
    {
        var normalized = Account.Normalize(username);
        rateLimiter.CheckLogin(ip, normalized);
        var account = await accounts.FindByLoginAsync(username);
        var matches = PasswordHasher.Matches(password, account?.PasswordHash ?? PasswordHasher.DummyHash);
        if (account is null || !matches) await FailedLoginAsync(account, normalized);
        var now = clock.GetUtcNow();
        if (account!.TemporarilyLocked(now)) throw new DomainException(ErrorCode.AUTH_TEMPORARILY_LOCKED);
        var displayName = account.Status == AccountStatus.LOCKED ? null : await principals.ActiveNameAsync(account);
        if (displayName is null) throw new DomainException(ErrorCode.AUTH_ACCOUNT_LOCKED);
        if (customerOnly && account.PrincipalType != PrincipalType.CUSTOMER) throw new DomainException(ErrorCode.ACCESS_DENIED);
        account.RegisterSuccessfulLogin(now);
        await accounts.SaveAsync();
        return (account, displayName);
    }

    private async Task FailedLoginAsync(Account? account, string normalized)
    {
        var now = clock.GetUtcNow();
        if (account is not null && account.TemporarilyLocked(now)) throw new DomainException(ErrorCode.AUTH_TEMPORARILY_LOCKED);
        if (account is not null)
        {
            var locked = account.RegisterFailedLogin(now, Settings.Login.MaxFailedAttempts, Settings.Login.TemporaryLock);
            await accounts.SaveAsync();
            await AuditAsync(account, "AUTH_LOGIN_FAILED", "Đăng nhập thất bại");
            if (locked) throw new DomainException(ErrorCode.AUTH_TEMPORARILY_LOCKED);
        }
        else
        {
            await audit.RecordAsync(normalized, normalized, ["ANONYMOUS"], "AUTH_LOGIN_FAILED", "Đăng nhập thất bại", "ACCOUNT", normalized);
        }
        throw new DomainException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    private Task<AuthResult> IssueAsync(Account account, string displayName, bool remember, string familyId, string? ip, string? userAgent, bool login = false) => transactions.InTransactionAsync(async () =>
    {
        var rawRefresh = RandomToken();
        var now = clock.GetUtcNow();
        var refreshTtl = remember ? Settings.Jwt.RefreshTokenRememberTtl : Settings.Jwt.RefreshTokenTtl;
        db.RefreshTokens.Add(new RefreshToken(Hash(rawRefresh), account.Id, familyId, now, now + refreshTtl, remember, Safe(ip), Safe(userAgent)));
        await db.SaveChangesAsync();
        var accessToken = jwt.IssueAccessToken(account, displayName, familyId);
        if (login) await AuditAsync(account, "AUTH_LOGIN_SUCCESS", "Đăng nhập thành công");
        return new AuthResult(
            accessToken,
            (long)Settings.Jwt.AccessTokenTtl.TotalSeconds,
            rawRefresh,
            remember,
            (long)refreshTtl.TotalSeconds,
            View(account, displayName));
    });

    private async Task<Account> RequireActiveAccountAsync(long id)
    {
        var account = await accounts.FindByIdAsync(id) ?? throw new DomainException(ErrorCode.AUTH_TOKEN_REVOKED);
        if (account.Status != AccountStatus.ACTIVE || !await principals.ActiveAsync(account))
            throw new DomainException(ErrorCode.AUTH_TOKEN_REVOKED);
        return account;
    }

    private Task RevokeFamilyAsync(string familyId, DateTimeOffset at) =>
        db.RefreshTokens.Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, at));

    private Task AuditAsync(Account account, string action, string label) =>
        audit.RecordAsync(AuditId(account), account.Username, account.Roles.Select(r => r.ToString()), action, label, "ACCOUNT", account.Id.ToString());

    private Task AuditReuseAsync(RefreshToken token) =>
        audit.RecordAsync(
            token.AccountId.ToString(), token.AccountId.ToString(), ["UNKNOWN"],
            "AUTH_REFRESH_REUSE_DETECTED", "Phát hiện dùng lại refresh token", "ACCOUNT", token.AccountId.ToString());

    /// <summary>Nhật ký theo quy ước: mã NV, "KH:&lt;mã KH&gt;", hoặc mã tài khoản nếu chưa gắn hồ sơ.</summary>
    private static string AuditId(Account account) =>
        account.EmployeeId ?? (account.CustomerId is not null ? "KH:" + account.CustomerId : account.Id.ToString());

    private static string RandomToken() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static string Base64UrlEncode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Safe(string? value) => value is null ? "" : value[..Math.Min(value.Length, 500)];
}
