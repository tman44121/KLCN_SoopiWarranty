using System.Net;
using System.Net.Mail;
using System.Text;

namespace Soopi.Api.Services.Shared;

public sealed class EmailDeliveryException(string message) : Exception(message);

public sealed record EmailMessage(string To, string Subject, string Body);

/// <summary>Gửi email (OTP). <c>Email:Provider</c> = <c>smtp</c> (gửi thật, ví dụ qua Gmail) hoặc <c>log</c>.</summary>
public interface IEmailSender
{
    /// <exception cref="EmailDeliveryException">Máy chủ mail không nhận thư.</exception>
    Task SendAsync(EmailMessage message);
}

/// <summary>Cấu hình mục <c>Email:Smtp</c>. Mật khẩu (Gmail: App Password 16 ký tự) đặt qua User Secrets hoặc biến môi trường.</summary>
public sealed class SmtpOptions
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string From { get; set; } = "";
    public string FromName { get; set; } = "Soopi";

    public bool Configured => !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password);
}

/// <summary>Gửi qua SMTP (STARTTLS cổng 587). Mỗi thư một <see cref="SmtpClient"/> vì lớp này không an toàn đa luồng.</summary>
public sealed class SmtpEmailSender(SmtpOptions options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message)
    {
        using var mail = new MailMessage
        {
            From = new MailAddress(string.IsNullOrWhiteSpace(options.From) ? options.Username : options.From, options.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = message.Body,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false,
        };
        mail.To.Add(message.To);
        using var client = new SmtpClient(options.Host, options.Port)
        {
            EnableSsl = options.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(options.Username, options.Password),
            Timeout = 15_000,
        };
        try
        {
            await client.SendMailAsync(mail);
        }
        catch (Exception exception) when (exception is SmtpException or InvalidOperationException or FormatException)
        {
            throw new EmailDeliveryException(exception.Message);
        }
    }
}

/// <summary>
/// Không có máy chủ mail: ghi nội dung thư (kể cả OTP) vào log để người thử lấy mã. Ở Production tuyệt đối không ghi OTP ra
/// log — coi như chưa cấu hình email và báo gửi thất bại.
/// </summary>
public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger, IHostEnvironment environment) : IEmailSender
{
    public Task SendAsync(EmailMessage message)
    {
        if (environment.IsProduction()) throw new EmailDeliveryException("Chưa cấu hình máy chủ mail (Email:Provider=smtp)");
        logger.LogInformation("[EMAIL] tới {To}: {Subject} — {Body}", message.To, message.Subject, message.Body);
        return Task.CompletedTask;
    }
}
