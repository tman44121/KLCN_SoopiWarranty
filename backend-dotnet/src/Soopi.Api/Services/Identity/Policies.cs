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

/// <summary>Không tự khóa / tự bỏ quyền Quản trị viên của mình; không khóa / bỏ quyền Quản trị viên cuối cùng.</summary>
public sealed class AccountPolicy(AccountStore accounts)
{
    public Task RequireCanLockAsync(AuthenticatedActor actor, Account target)
    {
        if (actor.AccountId == target.Id) throw new DomainException(ErrorCode.ACCOUNT_SELF_PROTECTION);
        return RequireAnotherAdminAsync(target, new HashSet<Role>());
    }

    public Task RequireCanChangeRolesAsync(AuthenticatedActor actor, Account target, IReadOnlySet<Role> newRoles)
    {
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
