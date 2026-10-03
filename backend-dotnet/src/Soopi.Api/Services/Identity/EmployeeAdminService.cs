using System.Text.RegularExpressions;
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

namespace Soopi.Api.Services.Identity;

/// <summary>Quản trị viên quản lý nhân viên, tài khoản và vai trò (POL-08).</summary>
public sealed partial class EmployeeAdminService(
    AppDbContext db,
    EmployeeRecordStore employees,
    AccountStore accounts,
    AccountPolicy policy,
    SecurityVersionCache securityVersions,
    CodeGenerator codes,
    CurrentActor actors,
    TransactionRunner transactions,
    AuditService audit,
    IOptions<SecurityOptions> options,
    TimeProvider clock)
{
    public async Task<List<EmployeeAccountView>> ListAsync(string? query, Role? role, string? status)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        // Hai lượt đọc trên cùng DbContext phải tuần tự (DbContext không an toàn đa luồng).
        var employeeAccounts = await accounts.FindEmployeeAccountsAsync();
        var records = await employees.FindAllAsync();
        var byId = employeeAccounts.Where(a => a.EmployeeId is not null)
            .GroupBy(a => a.EmployeeId!)
            .ToDictionary(group => group.Key, group => group.First());
        var needle = query?.Trim().ToLowerInvariant() ?? "";
        return records
            .Select(record => View(record, byId.GetValueOrDefault(record.Code)))
            .Where(view => needle.Length == 0 || Matches(view, needle))
            .Where(view => role is null || view.Roles.Any(r => r.Code == role.ToString()))
            .Where(view => string.IsNullOrWhiteSpace(status) || status == view.AccountStatus)
            .OrderBy(view => view.EmployeeId, StringComparer.Ordinal)
            .ToList();
    }

    public Task<CreatedEmployee> CreateAsync(EmployeeCreateRequest command)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            var roles = RequireStaffRoles(command.Roles);
            if (command.Username is null || !UsernamePattern().IsMatch(command.Username.Trim()))
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
            if (await accounts.FindByLoginAsync(command.Username) is not null) throw new DomainException(ErrorCode.ACCOUNT_USERNAME_DUPLICATE);
            var code = await codes.NextAsync(BusinessCodeType.Employee);
            var temporary = TemporaryPasswords.New();
            var account = await accounts.AddAsync(Account.Employee(command.Username, PasswordHasher.Encode(temporary), roles, code, true));
            var record = new EmployeeRecord(
                code,
                RequireText(command.FullName),
                PhoneNumber.Require(command.Phone),
                BlankToNull(command.Email),
                BlankToNull(command.Specialty),
                command.Skills?.ToList() ?? [],
                command.MaxActiveTickets is { } max ? Positive(max) : 10,
                true,
                "ACTIVE",
                "HCM",
                account.Id);
            await employees.SaveAsync(record);
            await RecordAsync(actor, "ACCOUNT_CREATED", "Thêm nhân viên", code, null, Summary(record, account));
            return new CreatedEmployee(View(record, account), temporary);
        });
    }

    public Task<EmployeeAccountView> UpdateAsync(string code, EmployeeUpdateRequest command)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            var current = await RequireEmployeeAsync(code);
            if (command.WorkStatus is not null && command.WorkStatus is not ("ACTIVE" or "INACTIVE"))
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
            var updated = current with
            {
                FullName = command.FullName is null ? current.FullName : RequireText(command.FullName),
                Phone = command.Phone is null ? current.Phone : PhoneNumber.Require(command.Phone),
                Email = command.Email is null ? current.Email : BlankToNull(command.Email),
                Specialty = command.Specialty is null ? current.Specialty : BlankToNull(command.Specialty),
                Skills = command.Skills?.ToList() ?? current.Skills,
                MaxActiveTickets = command.MaxActiveTickets is { } max ? Positive(max) : current.MaxActiveTickets,
                OnSite = command.OnSite ?? current.OnSite,
                WorkStatus = command.WorkStatus ?? current.WorkStatus,
            };
            await employees.SaveAsync(updated);
            var account = await accounts.FindByEmployeeIdAsync(code);
            await RecordAsync(actor, "EMPLOYEE_UPDATED", "Sửa hồ sơ nhân viên", code, Summary(current, account), Summary(updated, account));
            return View(updated, account);
        });
    }

    public Task<EmployeeAccountView> ChangeRolesAsync(string code, IReadOnlySet<Role>? roles)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        return MutateAccountAsync(code, "ACCOUNT_ROLES_CHANGED", "Cập nhật vai trò", async (actor, account) =>
        {
            var staffRoles = RequireStaffRoles(roles);
            await policy.RequireCanChangeRolesAsync(actor, account, staffRoles);
            account.ReplaceRoles(staffRoles);
        });
    }

    public Task<EmployeeAccountView> LockAsync(string code)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        return MutateAccountAsync(code, "ACCOUNT_LOCKED", "Khóa tài khoản", async (actor, account) =>
        {
            await policy.RequireCanLockAsync(actor, account);
            account.Lock();
            await RevokeTokensAsync(account.Id);
        });
    }

    public Task<EmployeeAccountView> UnlockAsync(string code)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        return MutateAccountAsync(code, "ACCOUNT_UNLOCKED", "Mở khóa tài khoản", (_, account) =>
        {
            account.Unlock();
            return Task.CompletedTask;
        });
    }

    /// <summary>
    /// Đặt lại về mật khẩu mặc định chung (Security:DefaultResetPassword, D-076) để quản trị viên báo miệng cho nhân viên. Vì
    /// ai cũng biết mật khẩu này, tài khoản bị buộc đổi mật khẩu ngay lần đăng nhập kế tiếp và mọi phiên cũ bị thu hồi.
    /// </summary>
    public async Task<string> ResetPasswordAsync(string code)
    {
        actors.Require(Permission.ACCOUNT_MANAGE);
        var defaultPassword = options.Value.DefaultResetPassword;
        if (string.IsNullOrWhiteSpace(defaultPassword))
            throw new InvalidOperationException("Chưa cấu hình Security:DefaultResetPassword (User Secrets/biến môi trường)");
        await MutateAccountAsync(code, "ACCOUNT_PASSWORD_RESET", "Đặt lại mật khẩu về mặc định", async (_, account) =>
        {
            account.ResetPassword(PasswordHasher.Encode(defaultPassword), clock.GetUtcNow());
            await RevokeTokensAsync(account.Id);
        });
        return defaultPassword;
    }

    private async Task<EmployeeAccountView> MutateAccountAsync(
        string code, string action, string label, Func<AuthenticatedActor, Account, Task> change)
    {
        var (accountId, view) = await transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            var record = await RequireEmployeeAsync(code);
            var account = await accounts.FindByEmployeeIdAsync(code) ?? throw new DomainException(ErrorCode.NOT_FOUND);
            var before = Summary(record, account);
            await change(actor, account);
            await accounts.SaveAsync();
            await RecordAsync(actor, action, label, code, before, Summary(record, account));
            return (account.Id, View(record, account));
        });
        securityVersions.Evict(accountId);
        return view;
    }

    private Task RevokeTokensAsync(long accountId)
    {
        var now = clock.GetUtcNow();
        return db.RefreshTokens.Where(t => t.AccountId == accountId && t.RevokedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now));
    }

    private async Task<EmployeeRecord> RequireEmployeeAsync(string code) =>
        await employees.FindAsync(code) ?? throw new DomainException(ErrorCode.NOT_FOUND);

    private Task RecordAsync(AuthenticatedActor actor, string action, string label, string code, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "EMPLOYEE", code, before, after);

    public static EmployeeAccountView View(EmployeeRecord record, Account? account) =>
        new(
            record.Code,
            record.FullName,
            record.Phone,
            record.Email,
            record.Specialty,
            record.Skills,
            record.MaxActiveTickets,
            record.OnSite,
            record.WorkStatus,
            account?.Username,
            account?.Roles.Select(RoleView.From).ToList() ?? [],
            account?.Status.ToString(),
            account?.LastLoginAt);

    /// <summary>Tóm tắt đọc được cho audit — không bao giờ chứa mật khẩu hay hash.</summary>
    private static string Summary(EmployeeRecord record, Account? account)
    {
        var roles = account is null ? "—" : string.Join(", ", account.Roles.Select(role => role.Label()).Order(StringComparer.Ordinal));
        var status = account is null ? "" : account.Status == AccountStatus.LOCKED ? " — Đã khóa" : " — Đang hoạt động";
        return record.Code + " — " + record.FullName + " — " + roles + status;
    }

    private static HashSet<Role> RequireStaffRoles(IReadOnlySet<Role>? roles) =>
        roles is null || roles.Count == 0 || roles.Contains(Role.CUSTOMER)
            ? throw new DomainException(ErrorCode.VALIDATION_FAILED)
            : roles.ToHashSet();

    private static string RequireText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? throw new DomainException(ErrorCode.VALIDATION_FAILED) : value.Trim();

    private static string? BlankToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static int Positive(int value) => value < 1 ? throw new DomainException(ErrorCode.VALIDATION_FAILED) : value;

    private static bool Matches(EmployeeAccountView view, string needle) =>
        view.EmployeeId.ToLowerInvariant().Contains(needle, StringComparison.Ordinal)
        || view.FullName.ToLowerInvariant().Contains(needle, StringComparison.Ordinal)
        || (view.Username?.ToLowerInvariant().Contains(needle, StringComparison.Ordinal) ?? false);

    [GeneratedRegex("^[A-Za-z0-9._-]{3,40}$")]
    private static partial Regex UsernamePattern();
}
