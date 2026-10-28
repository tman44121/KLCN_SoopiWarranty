using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Identity;

/// <summary>
/// OTP 6 chữ số gửi qua email: sống 5 phút, dùng một lần, tối đa 5 lần nhập sai. Không chạy trong transaction của người gọi
/// để lần nhập sai luôn được ghi lại kể cả khi thao tác chính thất bại.
/// </summary>
public sealed partial class OtpService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan ResendAfter = TimeSpan.FromSeconds(60);
    private const int MaxFailedAttempts = 5;
    private const string DefaultSubject = "Mã xác minh Soopi: {code}";
    private const string DefaultTemplate =
        "Mã xác minh Soopi của bạn là: {code}\n\nMã có hiệu lực trong 5 phút và chỉ dùng được một lần. "
        + "Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên Soopi.\n\nNếu bạn không yêu cầu mã, hãy bỏ qua email này.";

    private readonly OtpStore store;
    private readonly IEmailSender email;
    private readonly RateLimiter limiter;
    private readonly TimeProvider clock;
    private readonly ILogger<OtpService> logger;
    private readonly string subject;
    private readonly string template;

    public OtpService(OtpStore store, IEmailSender email, RateLimiter limiter, TimeProvider clock, IConfiguration configuration, ILogger<OtpService> logger)
    {
        this.store = store;
        this.email = email;
        this.limiter = limiter;
        this.clock = clock;
        this.logger = logger;
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
        limiter.Acquire("otp-email:" + address + ":" + purpose, 1, ResendAfter);
        limiter.Acquire("otp-email-hour:" + address, 5, TimeSpan.FromHours(1));
        var code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6");
        var now = clock.GetUtcNow();
        var id = await store.ReplaceAsync(address, purpose.ToString(), Hash(code), now, now + Ttl, clientIp);
        try
        {
            await email.SendAsync(new EmailMessage(address, subject.Replace("{code}", code), template.Replace("{code}", code)));
        }
        catch (EmailDeliveryException exception)
        {
            logger.LogWarning("Không gửi được OTP {Purpose} tới {Email}: {Message}", purpose, Mask(address), exception.Message);
            await store.ConsumeAsync(id, now);
            throw new DomainException(ErrorCode.OTP_SEND_FAILED);
        }
        return new OtpIssued((long)Ttl.TotalSeconds, (long)ResendAfter.TotalSeconds);
    }

    /// <summary>Sai mã, hết hạn, đã dùng hay sai quá số lần đều trả cùng một lỗi.</summary>
    public async Task ConsumeAsync(string address, OtpPurpose purpose, string? code)
    {
        var pending = await MatchAsync(address, purpose, code);
        if (!await store.ConsumeAsync(pending.Id, clock.GetUtcNow())) throw new DomainException(ErrorCode.OTP_INVALID);
    }

    /// <summary>
    /// Kiểm mã mà không tiêu (web chỉ mở bước đặt mật khẩu khi mã đúng). Lần sai vẫn được đếm chung với ConsumeAsync nên
    /// tổng số lần thử của một mã vẫn tối đa 5.
    /// </summary>
    public Task VerifyAsync(string address, OtpPurpose purpose, string? code) => MatchAsync(address, purpose, code);

    private async Task<PendingOtp> MatchAsync(string address, OtpPurpose purpose, string? code)
    {
        var pending = await store.LatestAsync(address, purpose.ToString(), clock.GetUtcNow());
        if (pending is null || pending.FailedAttempts >= MaxFailedAttempts) throw new DomainException(ErrorCode.OTP_INVALID);
        var matches = code is not null
            && SixDigits().IsMatch(code)
            && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(code)), Encoding.ASCII.GetBytes(pending.CodeHash.Trim()));
        if (!matches)
        {
            await store.RecordFailureAsync(pending.Id);
            throw new DomainException(ErrorCode.OTP_INVALID);
        }
        return pending;
    }

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
