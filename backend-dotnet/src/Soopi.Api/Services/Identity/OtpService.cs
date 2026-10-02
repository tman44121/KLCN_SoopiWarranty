using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Identity;

public sealed class SmsDeliveryException(string message) : Exception(message);

/// <summary>Gửi SMS (OTP). Chế độ <c>Sms:Provider = log</c>; gửi eSMS thật để đợt sau.</summary>
public interface ISmsSender
{
    /// <exception cref="SmsDeliveryException">Nhà cung cấp không nhận tin.</exception>
    Task SendAsync(string phone, string content);
}

/// <summary>
/// Không có nhà cung cấp SMS: ghi nội dung tin (kể cả OTP) vào log để người thử lấy mã. Ở Production tuyệt đối không ghi
/// OTP ra log — coi như chưa cấu hình SMS và báo gửi thất bại.
/// </summary>
public sealed class LoggingSmsSender(ILogger<LoggingSmsSender> logger, IHostEnvironment environment) : ISmsSender
{
    public Task SendAsync(string phone, string content)
    {
        if (environment.IsProduction()) throw new SmsDeliveryException("Chưa cấu hình nhà cung cấp SMS (Sms:Provider=esms)");
        logger.LogInformation("[SMS] tới {Phone}: {Content}", phone, content);
        return Task.CompletedTask;
    }
}

/// <summary>
/// OTP 6 chữ số gửi qua SMS: sống 5 phút, dùng một lần, tối đa 5 lần nhập sai. Không chạy trong transaction của người gọi
/// để lần nhập sai luôn được ghi lại kể cả khi thao tác chính thất bại.
/// </summary>
public sealed partial class OtpService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan ResendAfter = TimeSpan.FromSeconds(60);
    private const int MaxFailedAttempts = 5;
    private const string DefaultTemplate = "Ma xac minh Soopi: {code}. Ma het han sau 5 phut.";

    private readonly OtpStore store;
    private readonly ISmsSender sms;
    private readonly RateLimiter limiter;
    private readonly TimeProvider clock;
    private readonly ILogger<OtpService> logger;
    private readonly string template;

    public OtpService(OtpStore store, ISmsSender sms, RateLimiter limiter, TimeProvider clock, IConfiguration configuration, ILogger<OtpService> logger)
    {
        this.store = store;
        this.sms = sms;
        this.limiter = limiter;
        this.clock = clock;
        this.logger = logger;
        var configured = configuration["Sms:OtpTemplate"];
        template = string.IsNullOrWhiteSpace(configured) ? DefaultTemplate : configured;
        if (!template.Contains("{code}", StringComparison.Ordinal))
            throw new InvalidOperationException("Sms:OtpTemplate phải chứa {code}");
    }

    /// <summary>Chờ 60 giây mới gửi lại trong cùng một luồng; trần 5 tin/giờ tính chung mọi luồng để giữ chi phí SMS.</summary>
    public async Task<OtpIssued> IssueAsync(string phone, OtpPurpose purpose, string? clientIp)
    {
        limiter.Acquire("otp-phone:" + phone + ":" + purpose, 1, ResendAfter);
        limiter.Acquire("otp-phone-hour:" + phone, 5, TimeSpan.FromHours(1));
        var code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6");
        var now = clock.GetUtcNow();
        var id = await store.ReplaceAsync(phone, purpose.ToString(), Hash(code), now, now + Ttl, clientIp);
        try
        {
            await sms.SendAsync(phone, template.Replace("{code}", code));
        }
        catch (SmsDeliveryException exception)
        {
            logger.LogWarning("Không gửi được OTP {Purpose} tới {Phone}: {Message}", purpose, Mask(phone), exception.Message);
            await store.ConsumeAsync(id, now);
            throw new DomainException(ErrorCode.OTP_SEND_FAILED);
        }
        return new OtpIssued((long)Ttl.TotalSeconds, (long)ResendAfter.TotalSeconds);
    }

    /// <summary>Sai mã, hết hạn, đã dùng hay sai quá số lần đều trả cùng một lỗi.</summary>
    public async Task ConsumeAsync(string phone, OtpPurpose purpose, string? code)
    {
        var now = clock.GetUtcNow();
        var pending = await store.LatestAsync(phone, purpose.ToString(), now);
        if (pending is null || pending.FailedAttempts >= MaxFailedAttempts) throw new DomainException(ErrorCode.OTP_INVALID);
        var matches = code is not null
            && SixDigits().IsMatch(code)
            && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(code)), Encoding.ASCII.GetBytes(pending.CodeHash.Trim()));
        if (!matches)
        {
            await store.RecordFailureAsync(pending.Id);
            throw new DomainException(ErrorCode.OTP_INVALID);
        }
        if (!await store.ConsumeAsync(pending.Id, now)) throw new DomainException(ErrorCode.OTP_INVALID);
    }

    private static string Hash(string code) => AuthService.Hash(code);

    private static string Mask(string phone) => phone.Length <= 4 ? "****" : new string('*', phone.Length - 4) + phone[^4..];

    [GeneratedRegex("^[0-9]{6}$")]
    private static partial Regex SixDigits();
}
