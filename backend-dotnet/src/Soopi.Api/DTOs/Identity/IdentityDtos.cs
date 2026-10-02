using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Domain.Identity;

namespace Soopi.Api.DTOs.Identity;

public sealed record RoleView(string Code, string Label, string Landing)
{
    public static RoleView From(Role role) => new(role.ToString(), role.Label(), role.Landing());
}

public sealed record UserView(
    string AccountId,
    string Username,
    string DisplayName,
    string? EmployeeId,
    string? CustomerId,
    IReadOnlyList<RoleView> Roles,
    IReadOnlyList<string> Permissions,
    string Landing,
    bool MustChangePassword);

public sealed record AuthResult(string AccessToken, long ExpiresIn, string RefreshToken, bool Remember, long RefreshMaxAge, UserView User);

public sealed record AuthResponse(string AccessToken, long ExpiresIn, UserView User)
{
    public static AuthResponse From(AuthResult result) => new(result.AccessToken, result.ExpiresIn, result.User);
}

/// <summary>Như AuthResponse của web, thêm refresh token (và hạn) vì app không dùng cookie.</summary>
public sealed record MobileAuthResponse(string AccessToken, long ExpiresIn, string RefreshToken, long RefreshExpiresIn, UserView User)
{
    public static MobileAuthResponse From(AuthResult result) =>
        new(result.AccessToken, result.ExpiresIn, result.RefreshToken, result.RefreshMaxAge, result.User);
}

public sealed record LoginRequest([NotBlank] string Username, [NotBlank] string Password, bool Remember);

public sealed record ChangePasswordRequest([NotBlank] string CurrentPassword, [NotBlank] string NewPassword);

public sealed record MobileLoginBody([NotBlank] string Username, [NotBlank] string Password);

public sealed record RefreshBody([NotBlank] string RefreshToken);

public sealed record LogoutBody(string? RefreshToken, string? InstallationId, bool All);

public enum OtpPurpose
{
    REGISTER,
    RESET_PASSWORD,
}

public sealed record OtpBody([NotBlank] string Phone, [NotNull] OtpPurpose? Purpose);

public sealed record OtpIssued(long ExpiresIn, long ResendAfter);

public sealed record RegisterBody(
    [NotBlank] string Phone,
    [NotBlank] string Otp,
    string? FullName,
    [NotBlank] string Password,
    [Email] string? Email);

public sealed record PasswordResetBody([NotBlank] string Phone, [NotBlank] string Otp, [NotBlank] string NewPassword);

public sealed record EmployeeCreateRequest(
    [NotBlank] string FullName,
    [NotBlank] string Phone,
    string? Email,
    string? Specialty,
    List<string>? Skills,
    int? MaxActiveTickets,
    [NotBlank] string Username,
    [NotEmpty] HashSet<Role>? Roles);

public sealed record EmployeeUpdateRequest(
    string? FullName,
    string? Phone,
    string? Email,
    string? Specialty,
    List<string>? Skills,
    int? MaxActiveTickets,
    bool? OnSite,
    string? WorkStatus);

public sealed record RolesRequest([NotEmpty] HashSet<Role>? Roles);

public sealed record EmployeeAccountView(
    string EmployeeId,
    string FullName,
    string Phone,
    string? Email,
    string? Specialty,
    IReadOnlyList<string> Skills,
    int MaxActiveTickets,
    bool OnSite,
    string WorkStatus,
    string? Username,
    IReadOnlyList<RoleView> Roles,
    string? AccountStatus,
    DateTimeOffset? LastLoginAt);

public sealed record CreatedEmployee(EmployeeAccountView Employee, string TemporaryPassword);
