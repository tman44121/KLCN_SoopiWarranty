using System.ComponentModel.DataAnnotations.Schema;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Entities;

public enum AccountStatus
{
    ACTIVE,
    LOCKED,
}

public enum PrincipalType
{
    EMPLOYEE,
    CUSTOMER,
}

/// <summary>
/// Bảng TaiKhoan + TaiKhoan_VaiTro. Liên kết tới hồ sơ đi theo chiều ngược (NhanVien.MaTaiKhoan, KhachHang.MaTaiKhoan)
/// nên mã NV/mã KH chỉ đọc, do AccountStore điền khi tải tài khoản.
/// </summary>
public class Account
{
    public long Id { get; private set; }

    public string Username { get; private set; } = "";

    public string PasswordHash { get; private set; } = "";

    public List<AccountRole> RoleRows { get; private set; } = [];

    public PrincipalType PrincipalType { get; private set; }

    public AccountStatus Status { get; private set; }

    public int FailedLoginAttempts { get; private set; }

    public DateTimeOffset? TemporaryLockUntil { get; private set; }

    public bool MustChangePassword { get; private set; }

    public int SecurityVersion { get; private set; }

    public DateTimeOffset? LastLoginAt { get; private set; }

    public DateTimeOffset? PasswordChangedAt { get; private set; }

    [NotMapped] public string? EmployeeId { get; set; }

    [NotMapped] public string? CustomerId { get; set; }

    /// <summary>Vai trò theo thứ tự khai báo của enum (vai trò đầu tiên quyết định trang đích).</summary>
    [NotMapped] public IReadOnlyList<Role> Roles => RoleRows.Select(row => row.Role).Distinct().Order().ToList();

    public static Account Employee(string username, string passwordHash, IEnumerable<Role> roles, string employeeId, bool mustChangePassword) =>
        Create(username, passwordHash, roles, PrincipalType.EMPLOYEE, employeeId, null, mustChangePassword);

    public static Account Customer(string username, string passwordHash, string customerId, bool mustChangePassword) =>
        Create(username, passwordHash, [Role.CUSTOMER], PrincipalType.CUSTOMER, null, customerId, mustChangePassword);

    private static Account Create(
        string username, string passwordHash, IEnumerable<Role> roles, PrincipalType principalType,
        string? employeeId, string? customerId, bool mustChangePassword) =>
        new()
        {
            Username = JavaText.Trim(username),
            PasswordHash = passwordHash,
            RoleRows = roles.Distinct().Select(role => new AccountRole { Role = role }).ToList(),
            PrincipalType = principalType,
            EmployeeId = employeeId,
            CustomerId = customerId,
            Status = AccountStatus.ACTIVE,
            FailedLoginAttempts = 0,
            MustChangePassword = mustChangePassword,
            SecurityVersion = 1,
        };

    public bool TemporarilyLocked(DateTimeOffset now) => TemporaryLockUntil is { } until && until > now;

    public bool RegisterFailedLogin(DateTimeOffset now, int maxAttempts, TimeSpan lockDuration)
    {
        FailedLoginAttempts++;
        if (FailedLoginAttempts < maxAttempts) return false;
        TemporaryLockUntil = now + lockDuration;
        return true;
    }

    public void RegisterSuccessfulLogin(DateTimeOffset now)
    {
        FailedLoginAttempts = 0;
        TemporaryLockUntil = null;
        LastLoginAt = now;
    }

    public void ChangePassword(string encodedPassword, DateTimeOffset now)
    {
        PasswordHash = encodedPassword;
        PasswordChangedAt = now;
        MustChangePassword = false;
        SecurityVersion++;
    }

    /// <summary>
    /// Chủ tài khoản đặt lại mật khẩu sau khi xác minh OTP: xóa luôn bộ đếm sai và khóa tạm do người khác đoán mật khẩu.
    /// Khóa của Quản trị viên (LOCKED) giữ nguyên.
    /// </summary>
    public void RecoverPassword(string encodedPassword, DateTimeOffset now)
    {
        ChangePassword(encodedPassword, now);
        FailedLoginAttempts = 0;
        TemporaryLockUntil = null;
    }

    /// <summary>Mọi thay đổi quyền/khóa/mật khẩu tăng SecurityVersion để vô hiệu access token cũ.</summary>
    public void ReplaceRoles(IReadOnlyCollection<Role> newRoles)
    {
        if (newRoles.Count == 0 || newRoles.Contains(Role.CUSTOMER)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        RoleRows.RemoveAll(row => !newRoles.Contains(row.Role));
        foreach (var role in newRoles.Distinct().Where(role => RoleRows.All(row => row.Role != role)))
            RoleRows.Add(new AccountRole { AccountId = Id, Role = role });
        SecurityVersion++;
    }

    public void Lock()
    {
        Status = AccountStatus.LOCKED;
        SecurityVersion++;
    }

    public void Unlock()
    {
        Status = AccountStatus.ACTIVE;
        FailedLoginAttempts = 0;
        TemporaryLockUntil = null;
        SecurityVersion++;
    }

    /// <summary>
    /// Mật khẩu tạm do nhân viên đặt lại — bắt buộc đổi ở lần đăng nhập kế tiếp. Xóa luôn khóa tạm do sai mật khẩu (thường chính
    /// là lý do cần đặt lại); khóa của Quản trị viên (LOCKED) giữ nguyên.
    /// </summary>
    public void ResetPassword(string encodedTemporaryPassword, DateTimeOffset now)
    {
        PasswordHash = encodedTemporaryPassword;
        PasswordChangedAt = now;
        MustChangePassword = true;
        FailedLoginAttempts = 0;
        TemporaryLockUntil = null;
        SecurityVersion++;
    }

    /// <summary>Tên đăng nhập của khách là SĐT: đổi SĐT hồ sơ thì đổi theo và thu hồi phiên cũ.</summary>
    public void ChangeUsername(string username)
    {
        Username = Normalize(username);
        SecurityVersion++;
    }

    public static string Normalize(string? username) => username is null ? "" : JavaText.Trim(username).ToLowerInvariant();
}

public class AccountRole
{
    public long AccountId { get; set; }

    public Role Role { get; set; }
}
