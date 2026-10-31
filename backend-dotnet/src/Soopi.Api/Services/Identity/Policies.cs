using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Services.Identity;

/// <summary>Mật khẩu ≥ 10 ký tự, có chữ và số, không chứa tên đăng nhập, không thuộc danh sách mật khẩu phổ biến.</summary>
public sealed class PasswordPolicy
{
    private readonly HashSet<string> commonPasswords = Load();

    public void Validate(string username, string? password)
    {
        var normalized = password?.ToLowerInvariant() ?? "";
        var valid = password is not null
            && password.Length >= 10
            && password.Any(char.IsLetter)
            && password.Any(char.IsDigit)
            && !normalized.Contains(username.ToLowerInvariant(), StringComparison.Ordinal)
            && !commonPasswords.Contains(normalized);
        if (!valid) throw new DomainException(ErrorCode.AUTH_PASSWORD_POLICY);
    }

    private static HashSet<string> Load()
    {
        using var stream = typeof(PasswordPolicy).Assembly.GetManifestResourceStream("Soopi.Api.Resources.common-passwords.txt")
            ?? throw new InvalidOperationException("Không đọc được danh sách mật khẩu phổ biến");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd()
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .Select(line => line.ToLowerInvariant())
            .ToHashSet();
    }
}

/// <summary>Chỉ tài khoản admin quản lý quản trị viên; giữ bảo vệ tự khóa và quản trị viên cuối cùng.</summary>
public sealed class AccountPolicy(AccountStore accounts)
{
    // Chủ dự án chỉ định tài khoản admin hiện tại làm quản trị gốc; API nhân viên không cho đổi tên đăng nhập.
    public static bool IsRootAdmin(string username, IEnumerable<Role> roles) =>
        string.Equals(username, "admin", StringComparison.OrdinalIgnoreCase) && roles.Contains(Role.ADMIN);

    public void RequireCanManage(AuthenticatedActor actor, Account target)
    {
        if (!actor.Roles.Contains(Role.ADMIN) || target.PrincipalType != PrincipalType.EMPLOYEE
            || target.Roles.Contains(Role.ADMIN) && !IsRootAdmin(actor.Username, actor.Roles))
            throw new DomainException(ErrorCode.ACCESS_DENIED);
    }

    public void RequireCanAssignRoles(AuthenticatedActor actor, IReadOnlySet<Role> roles)
    {
        if (!actor.Roles.Contains(Role.ADMIN) || roles.Contains(Role.ADMIN) && !IsRootAdmin(actor.Username, actor.Roles))
            throw new DomainException(ErrorCode.ACCESS_DENIED);
    }

    public static void RequireCustomerAccount(Account account)
    {
        if (account.PrincipalType != PrincipalType.CUSTOMER || account.Roles.Count != 1 || !account.Roles.Contains(Role.CUSTOMER))
            throw new DomainException(ErrorCode.ACCESS_DENIED);
    }

    public Task RequireCanLockAsync(AuthenticatedActor actor, Account target)
    {
        RequireCanManage(actor, target);
        if (actor.AccountId == target.Id) throw new DomainException(ErrorCode.ACCOUNT_SELF_PROTECTION);
        return RequireAnotherAdminAsync(target, new HashSet<Role>());
    }

    public Task RequireCanChangeRolesAsync(AuthenticatedActor actor, Account target, IReadOnlySet<Role> newRoles)
    {
        RequireCanManage(actor, target);
        RequireCanAssignRoles(actor, newRoles);
        if (actor.AccountId == target.Id && !newRoles.Contains(Role.ADMIN)) throw new DomainException(ErrorCode.ACCOUNT_SELF_PROTECTION);
        return RequireAnotherAdminAsync(target, newRoles);
    }

    private async Task RequireAnotherAdminAsync(Account target, IReadOnlySet<Role> resultingRoles)
    {
        if (target.Roles.Contains(Role.ADMIN)
            && !resultingRoles.Contains(Role.ADMIN)
            && await accounts.CountActiveWithRoleAsync(Role.ADMIN) <= 1)
            throw new DomainException(ErrorCode.ACCOUNT_LAST_ADMIN);
    }
}
