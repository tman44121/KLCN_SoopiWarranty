using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Identity;

/// <summary>
/// OTP 6 chữ số gửi qua email: sống 5 phút, dùng một lần, tối đa 5 lần nhập sai. Xác minh trong giao dịch riêng trước
/// nghiệp vụ đăng ký/khôi phục để lượt sai được commit trước khi trả lỗi.
/// </summary>
public sealed partial class OtpService
{
    private const string DefaultSubject = "Mã xác minh Soopi: {code}";
    private const string DefaultTemplate =
        "Mã xác minh Soopi của bạn là: {code}\n\nMã có hiệu lực trong {minutes} phút và chỉ dùng được một lần. "
        + "Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên Soopi.\n\nNếu bạn không yêu cầu mã, hãy bỏ qua email này.";

    private readonly OtpStore store;
    private readonly IEmailSender email;
    private readonly RateLimiter limiter;
    private readonly TimeProvider clock;
    private readonly ILogger<OtpService> logger;
    private readonly TransactionRunner transactions;
    private readonly TimeSettingsService timeSettings;
    private readonly string subject;
    private readonly string template;

    public OtpService(OtpStore store, IEmailSender email, RateLimiter limiter, TimeProvider clock, IConfiguration configuration, ILogger<OtpService> logger,
        TransactionRunner transactions, TimeSettingsService timeSettings)
    {
        this.store = store;
        this.email = email;
        this.limiter = limiter;
        this.clock = clock;
        this.logger = logger;
        this.transactions = transactions;
        this.timeSettings = timeSettings;
        var configuredSubject = configuration["Email:OtpSubject"];
        subject = string.IsNullOrWhiteSpace(configuredSubject) ? DefaultSubject : configuredSubject;
        var configured = configuration["Email:OtpTemplate"];
        template = string.IsNullOrWhiteSpace(configured) ? DefaultTemplate : configured;
        if (!template.Contains("{code}", StringComparison.Ordinal))
            throw new InvalidOperationException("Email:OtpTemplate phải chứa {code}");
    }

    /// <summary>Chờ 60 giây mới gửi lại trong cùng một luồng; trần 5 thư/giờ tính chung mọi luồng để không bị coi là spam.</summary>
    public async Task<OtpIssued> IssueAsync(string address, OtpPurpose purpose, string? clientIp)
    {
        var settings = (await timeSettings.GetAsync()).Protection;
        var ttl = TimeSpan.FromMinutes(settings.OtpValidityMinutes);
        var resendAfter = TimeSpan.FromSeconds(settings.OtpResendSeconds);
        limiter.Acquire("otp-email:" + address + ":" + purpose, 1, resendAfter);
        limiter.Acquire("otp-email-hour:" + address, settings.OtpEmail);
        var code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6");
        var now = clock.GetUtcNow();
        var id = await store.ReplaceAsync(address, purpose.ToString(), Hash(code), now, now + ttl, clientIp);
        try
        {
            await email.SendAsync(new EmailMessage(address, subject.Replace("{code}", code),
                template.Replace("{code}", code).Replace("{minutes}", settings.OtpValidityMinutes.ToString())));
        }
        catch (EmailDeliveryException exception)
        {
            logger.LogWarning("Không gửi được OTP {Purpose} tới {Email}: {Message}", purpose, Mask(address), exception.Message);
            await store.ConsumeAsync(id, now);
            throw new DomainException(ErrorCode.OTP_SEND_FAILED);
        }
        return new OtpIssued((long)ttl.TotalSeconds, (long)resendAfter.TotalSeconds);
    }

    /// <summary>Sai mã, hết hạn, đã dùng hay sai quá số lần đều trả cùng một lỗi.</summary>
    public async Task ConsumeAsync(string address, OtpPurpose purpose, string? code)
    {
        if (!await MatchAsync(address, purpose, code, consume: true)) throw new DomainException(ErrorCode.OTP_INVALID);
    }

    /// <summary>
    /// Kiểm mã mà không tiêu (web chỉ mở bước đặt mật khẩu khi mã đúng). Lần sai vẫn được đếm chung với ConsumeAsync nên
    /// tổng số lần thử của một mã vẫn tối đa 5.
    /// </summary>
    public async Task VerifyAsync(string address, OtpPurpose purpose, string? code)
    {
        if (!await MatchAsync(address, purpose, code, consume: false)) throw new DomainException(ErrorCode.OTP_INVALID);
    }

    private Task<bool> MatchAsync(string address, OtpPurpose purpose, string? code, bool consume) => transactions.InTransactionAsync(async () =>
    {
        var settings = (await timeSettings.GetAsync()).Protection;
        var pending = await store.LatestAsync(address, purpose.ToString(), clock.GetUtcNow());
        if (pending is null || pending.ExpiresAt <= clock.GetUtcNow() || pending.FailedAttempts >= settings.OtpMaxFailedAttempts) return false;
        var matches = code is not null
            && SixDigits().IsMatch(code)
            && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(code)), Encoding.ASCII.GetBytes(pending.CodeHash.Trim()));
        if (!matches)
        {
            await store.RecordFailureAsync(pending.Id);
            return false;
        }
        return !consume || await store.ConsumeAsync(pending.Id, clock.GetUtcNow());
    });

    private static string Hash(string code) => AuthService.Hash(code);

    /// <summary>Giữ 2 ký tự đầu và tên miền: <c>hs****@gmail.com</c>.</summary>
    private static string Mask(string address)
    {
        var at = address.IndexOf('@');
        return at <= 2 ? "****" + address[Math.Max(at, 0)..] : address[..2] + "****" + address[at..];
    }

    [GeneratedRegex("^[0-9]{6}$")]
    private static partial Regex SixDigits();
}
