using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Notifications;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Customers;

/// <summary>
/// Trạng thái tài khoản đăng nhập của khách: NONE (chưa đăng ký), ACTIVE, LOCKED (Quản trị viên khóa), TEMP_LOCKED (tự khóa tạm
/// do nhập sai mật khẩu nhiều lần, hết hạn thì tự mở).
/// </summary>
public sealed record CustomerAccountView(
    string Code, string FullName, string Phone, string? Email, string? Address, string Status, string? MergedInto, DateTimeOffset CreatedAt,
    string AccountStatus, string? Username, DateTimeOffset? LastLoginAt, DateTimeOffset? TemporaryLockUntil);

public sealed record CustomerAccountDetail(CustomerAccountView Customer, long Devices, long OpenTickets);

public sealed record LockCustomerAccountRequest([NotBlank] string Reason);

/// <summary>Quản lý tài khoản đăng nhập của khách: Quản trị viên khóa/mở khóa, Quản trị viên và lễ tân đặt lại mật khẩu.</summary>
public sealed class CustomerAccountAdminService(
    AppDbContext db,
    Sql sql,
    AccountStore accounts,
    PushDeviceService pushDevices,
    SecurityVersionCache securityVersions,
    CurrentActor actors,
    TransactionRunner transactions,
    AuditService audit,
    TimeProvider clock)
{
    private static readonly HashSet<string> AccountStatuses = ["NONE", "ACTIVE", "LOCKED", "TEMP_LOCKED"];

    public async Task<PageResponse<CustomerAccountView>> SearchAsync(string? query, string? status, string? accountStatus, int page, int size)
    {
        actors.Require(Permission.CUSTOMER_ACCOUNT_MANAGE);
        new PageRequestParams(page, size, null).Validate();
        CustomerStatus? customerStatus = string.IsNullOrWhiteSpace(status) ? null
            : Enum.TryParse<CustomerStatus>(status, out var parsed) ? parsed : throw new DomainException(ErrorCode.VALIDATION_FAILED);
        if (!string.IsNullOrWhiteSpace(accountStatus) && !AccountStatuses.Contains(accountStatus))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var now = clock.GetUtcNow();
        var rows = from customer in db.Customers
                   join account in db.Accounts on customer.AccountId equals (long?)account.Id into linked
                   from account in linked.DefaultIfEmpty()
                   select new Row { Customer = customer, Account = account };
        if (customerStatus is { } wanted) rows = rows.Where(row => row.Customer.Status == wanted);
        if (!string.IsNullOrWhiteSpace(query))
        {
            var pattern = SqlLike.Contains(query.Trim());
            rows = rows.Where(row => EF.Functions.Like(row.Customer.Id, pattern) || EF.Functions.Like(row.Customer.FullName, pattern)
                || EF.Functions.Like(row.Customer.Phone, pattern));
        }
        rows = accountStatus switch
        {
            "NONE" => rows.Where(row => row.Account == null),
            "LOCKED" => rows.Where(row => row.Account != null && row.Account.Status == AccountStatus.LOCKED),
            "TEMP_LOCKED" => rows.Where(row => row.Account != null && row.Account.Status == AccountStatus.ACTIVE
                && row.Account.TemporaryLockUntil != null && row.Account.TemporaryLockUntil > now),
            "ACTIVE" => rows.Where(row => row.Account != null && row.Account.Status == AccountStatus.ACTIVE
                && (row.Account.TemporaryLockUntil == null || row.Account.TemporaryLockUntil <= now)),
            _ => rows,
        };
        var total = await rows.LongCountAsync();
        var items = await rows.OrderByDescending(row => row.Customer.CreatedAt).ThenByDescending(row => row.Customer.Id)
            .Skip(page * size).Take(size).AsNoTracking().ToListAsync();
        return PageResponse<CustomerAccountView>.Of(items.Select(row => View(row.Customer, row.Account, now)).ToList(), page, size, total);
    }

    public async Task<CustomerAccountDetail> GetAsync(string code)
    {
        actors.Require(Permission.CUSTOMER_ACCOUNT_MANAGE);
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == code)
            ?? throw new DomainException(ErrorCode.CUSTOMER_NOT_FOUND);
        var account = await accounts.FindByIdAsync(customer.AccountId);
        var counts = await sql.FirstOrDefaultAsync(
            "SELECT (SELECT COUNT(*) FROM ThietBi WHERE MaKH = ?) AS devices, "
            + "(SELECT COUNT(*) FROM PhieuTiepNhan WHERE MaKH = ? AND ConMo = 1) AS openTickets",
            row => (Devices: row.Long("devices"), OpenTickets: row.Long("openTickets")),
            code, code);
        return new CustomerAccountDetail(View(customer, account, clock.GetUtcNow()), counts.Devices, counts.OpenTickets);
    }

    /// <summary>Khóa ngay: thu hồi mọi phiên và thiết bị nhận push. Hồ sơ đã lưu trữ/gộp vẫn khóa được.</summary>
    public async Task<CustomerAccountDetail> LockAsync(string code, string? reason)
    {
        actors.Require(Permission.CUSTOMER_ACCOUNT_MANAGE);
        if (JavaText.IsBlank(reason)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var accountId = await transactions.InTransactionAsync(async () =>
        {
            var (customer, account) = await RequireAccountAsync(code);
            if (account.Status == AccountStatus.LOCKED) throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_LOCKED);
            await LockAsync(account);
            await AuditAsync("CUSTOMER_ACCOUNT_LOCKED", "Khóa tài khoản khách", customer.Id, "Đang hoạt động",
                "Đã khóa — Lý do: " + JavaText.Trim(reason));
            return account.Id;
        });
        securityVersions.Evict(accountId);
        return await GetAsync(code);
    }

    /// <summary>Mở khóa cả khóa của Quản trị viên lẫn khóa tạm do sai mật khẩu; hồ sơ phải còn hoạt động.</summary>
    public async Task<CustomerAccountDetail> UnlockAsync(string code)
    {
        actors.Require(Permission.CUSTOMER_ACCOUNT_MANAGE);
        var accountId = await transactions.InTransactionAsync(async () =>
        {
            var (customer, account) = await RequireAccountAsync(code);
            if (customer.Status != CustomerStatus.ACTIVE) throw new DomainException(ErrorCode.CUSTOMER_PROFILE_INACTIVE);
            var before = Describe(account, clock.GetUtcNow());
            account.Unlock();
            await accounts.SaveAsync();
            await AuditAsync("CUSTOMER_ACCOUNT_UNLOCKED", "Mở khóa tài khoản khách", customer.Id, before, "Đang hoạt động");
            return account.Id;
        });
        securityVersions.Evict(accountId);
        return await GetAsync(code);
    }

    /// <summary>Mật khẩu tạm ngẫu nhiên chỉ trả về một lần; khách phải đổi khi đăng nhập, mọi phiên cũ bị đăng xuất.</summary>
    public async Task<string> ResetPasswordAsync(string code)
    {
        actors.Require(Permission.CUSTOMER_PASSWORD_RESET);
        var temporary = TemporaryPasswords.New();
        var accountId = await transactions.InTransactionAsync(async () =>
        {
            var (customer, account) = await RequireAccountAsync(code);
            if (customer.Status != CustomerStatus.ACTIVE) throw new DomainException(ErrorCode.CUSTOMER_PROFILE_INACTIVE);
            if (account.Status == AccountStatus.LOCKED) throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_LOCKED);
            account.ResetPassword(PasswordHasher.Encode(temporary), clock.GetUtcNow());
            await accounts.SaveAsync();
            await RevokeSessionsAsync(account.Id);
            await AuditAsync("CUSTOMER_PASSWORD_RESET", "Đặt lại mật khẩu khách (mật khẩu tạm)", customer.Id, null, null);
            return account.Id;
        });
        securityVersions.Evict(accountId);
        return temporary;
    }

    /// <summary>
    /// Gọi trong transaction của CustomerService khi lưu trữ/gộp hồ sơ: khóa tài khoản đang mở. Trả về id tài khoản đã khóa để
    /// bên gọi xóa cache phiên bản bảo mật sau khi commit.
    /// </summary>
    internal async Task<long?> LockForInactiveProfileAsync(string customerCode, long? accountId, string reason)
    {
        var account = await accounts.FindByIdAsync(accountId);
        if (account is null || account.Status == AccountStatus.LOCKED) return null;
        await LockAsync(account);
        await AuditAsync("CUSTOMER_ACCOUNT_LOCKED", "Khóa tài khoản khách", customerCode, "Đang hoạt động", "Đã khóa — Lý do: " + reason);
        return account.Id;
    }

    /// <summary>
    /// Tên đăng nhập của khách là SĐT: đổi SĐT hồ sơ thì đổi theo (gọi trong transaction của CustomerService). Tài khoản có tên
    /// đăng nhập khác SĐT cũ (dữ liệu cũ, VD "kh.tuan") giữ nguyên tên.
    /// </summary>
    internal async Task<long?> FollowPhoneAsync(long? accountId, string oldPhone, string newPhone)
    {
        if (oldPhone == newPhone) return null;
        var account = await accounts.FindByIdAsync(accountId);
        if (account is null || account.Username != Account.Normalize(oldPhone)) return null;
        if (await accounts.FindByLoginAsync(newPhone) is { } other && other.Id != account.Id)
            throw new DomainException(ErrorCode.ACCOUNT_USERNAME_DUPLICATE);
        account.ChangeUsername(newPhone);
        await accounts.SaveAsync();
        await RevokeSessionsAsync(account.Id);
        return account.Id;
    }

    private async Task LockAsync(Account account)
    {
        account.Lock();
        await accounts.SaveAsync();
        await RevokeSessionsAsync(account.Id);
        await pushDevices.ForgetAllAsync(account.Id);
    }

    private Task RevokeSessionsAsync(long accountId)
    {
        var now = clock.GetUtcNow();
        return db.RefreshTokens.Where(t => t.AccountId == accountId && t.RevokedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now));
    }

    private async Task<(Customer Customer, Account Account)> RequireAccountAsync(string code)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == code) ?? throw new DomainException(ErrorCode.CUSTOMER_NOT_FOUND);
        var account = await accounts.FindByIdAsync(customer.AccountId) ?? throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_NOT_FOUND);
        return (customer, account);
    }

    private Task AuditAsync(string action, string label, string code, string? before, string? after)
    {
        var actor = actors.Current;
        return audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "CUSTOMER", code, before, after);
    }

    private static string AccountStatusOf(Account? account, DateTimeOffset now) =>
        account is null ? "NONE"
        : account.Status == AccountStatus.LOCKED ? "LOCKED"
        : account.TemporarilyLocked(now) ? "TEMP_LOCKED"
        : "ACTIVE";

    private static string Describe(Account account, DateTimeOffset now) => AccountStatusOf(account, now) switch
    {
        "LOCKED" => "Đã khóa",
        "TEMP_LOCKED" => "Tạm khóa do đăng nhập sai nhiều lần",
        _ => "Đang hoạt động",
    };

    private static CustomerAccountView View(Customer customer, Account? account, DateTimeOffset now) =>
        new(customer.Id, customer.FullName, customer.Phone, customer.Email, customer.Address, customer.Status.ToString(), customer.MergedInto,
            customer.CreatedAt, AccountStatusOf(account, now), account?.Username, account?.LastLoginAt, account?.TemporaryLockUntil);

    private sealed class Row
    {
        public required Customer Customer { get; init; }

        public Account? Account { get; init; }
    }
}
