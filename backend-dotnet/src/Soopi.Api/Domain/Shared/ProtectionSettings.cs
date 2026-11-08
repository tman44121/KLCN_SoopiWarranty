namespace Soopi.Api.Domain.Shared;

public sealed record RateLimitSetting(int Limit, int WindowMinutes)
{
    internal TimeSpan Window => TimeSpan.FromMinutes(WindowMinutes);

    public void Validate(string name)
    {
        if (Limit is < 1 or > 10000 || WindowMinutes is < 1 or > 1440)
            throw DomainException.Invalid($"{name}: số lượt từ 1–10000, khoảng giới hạn từ 1–1440 phút.");
    }
}

/// <summary>Chỉ quản trị viên được đọc/ghi. Giới hạn dùng cửa sổ cố định; hết cửa sổ mới được gửi tiếp.</summary>
public sealed record ProtectionSettings
{
    public int LoginMaxFailedAttempts { get; init; } = 5;
    public int LoginLockMinutes { get; init; } = 15;
    public int OtpValidityMinutes { get; init; } = 5;
    public int OtpResendSeconds { get; init; } = 60;
    public int OtpMaxFailedAttempts { get; init; } = 5;
    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenHours { get; init; } = 12;
    public int RememberTokenDays { get; init; } = 30;
    public int PortalTokenMinutes { get; init; } = 30;
    public RateLimitSetting LoginIp { get; init; } = new(10, 1);
    public RateLimitSetting LoginAccount { get; init; } = new(5, 1);
    public RateLimitSetting OtpIp { get; init; } = new(20, 60);
    public RateLimitSetting OtpEmail { get; init; } = new(5, 60);
    public RateLimitSetting WarrantyCheckIp { get; init; } = new(10, 1);
    public RateLimitSetting LookupIp { get; init; } = new(5, 1);
    public RateLimitSetting LookupCode { get; init; } = new(10, 60);
    public RateLimitSetting PublicRequestsIp { get; init; } = new(3, 60);
    public RateLimitSetting CustomerRequests { get; init; } = new(5, 60);

    public ProtectionSettings Validated()
    {
        static void Range(int n, int min, int max, string name)
        {
            if (n < min || n > max) throw DomainException.Invalid($"{name} phải từ {min} đến {max}.");
        }
        Range(LoginMaxFailedAttempts, 1, 20, "Số lần sai mật khẩu");
        Range(LoginLockMinutes, 1, 1440, "Thời gian khóa đăng nhập (phút)");
        Range(OtpValidityMinutes, 1, 30, "Hạn OTP (phút)");
        Range(OtpResendSeconds, 1, 3600, "Chờ gửi lại OTP (giây)");
        Range(OtpMaxFailedAttempts, 1, 10, "Số lần sai OTP");
        Range(AccessTokenMinutes, 1, 1440, "Hạn phiên truy cập (phút)");
        Range(RefreshTokenHours, 1, 720, "Hạn đăng nhập thường (giờ)");
        Range(RememberTokenDays, 1, 90, "Hạn ghi nhớ đăng nhập (ngày)");
        Range(PortalTokenMinutes, 1, 1440, "Hạn phiên tra cứu (phút)");
        if (AccessTokenMinutes > RefreshTokenHours * 60 || RefreshTokenHours > RememberTokenDays * 24)
            throw DomainException.Invalid("Hạn phiên truy cập ≤ hạn đăng nhập thường ≤ hạn ghi nhớ đăng nhập.");
        foreach (var (name, policy) in new (string, RateLimitSetting?)[]
        {
            ("Đăng nhập theo IP", LoginIp), ("Đăng nhập theo tài khoản", LoginAccount),
            ("Gửi OTP theo IP", OtpIp), ("Gửi OTP theo email", OtpEmail),
            ("Kiểm tra bảo hành", WarrantyCheckIp), ("Tra cứu theo IP", LookupIp), ("Tra cứu theo mã", LookupCode),
            ("Gửi phiếu vãng lai", PublicRequestsIp), ("Gửi phiếu theo tài khoản", CustomerRequests),
        })
        {
            if (policy is null) throw DomainException.Invalid($"Thiếu giới hạn {name}.");
            policy.Validate(name);
        }
        return this;
    }
}
