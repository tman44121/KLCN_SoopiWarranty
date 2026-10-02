namespace Soopi.Api.Infrastructure.Security;

/// <summary>Khóa cấu hình "Security" (bản Java: app.security.*).</summary>
public sealed class SecurityOptions
{
    public string AllowedOrigins { get; set; } = "";

    /// <summary>Mật khẩu sau khi quản trị viên "Đặt lại mật khẩu" (D-076); bí mật — chỉ đặt qua User Secrets/biến môi trường.</summary>
    public string DefaultResetPassword { get; set; } = "";

    public JwtOptions Jwt { get; set; } = new();

    public LoginOptions Login { get; set; } = new();

    public IReadOnlySet<string> Origins =>
        AllowedOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();

    public sealed class JwtOptions
    {
        public string Issuer { get; set; } = "longmanloc-service-center";

        public TimeSpan AccessTokenTtl { get; set; } = TimeSpan.FromMinutes(15);

        public TimeSpan RefreshTokenTtl { get; set; } = TimeSpan.FromHours(12);

        public TimeSpan RefreshTokenRememberTtl { get; set; } = TimeSpan.FromDays(30);

        public TimeSpan PortalTokenTtl { get; set; } = TimeSpan.FromMinutes(30);

        public string PrivateKeyLocation { get; set; } = "";

        public string PublicKeyLocation { get; set; } = "";
    }

    public sealed class LoginOptions
    {
        public int MaxFailedAttempts { get; set; } = 5;

        public TimeSpan TemporaryLock { get; set; } = TimeSpan.FromMinutes(15);
    }
}
