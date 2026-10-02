using Soopi.Api.Data;
using Soopi.Api.Data.Stores;

namespace Soopi.Api.Services.Shared;

public sealed record PushMessage(string Token, string Title, string Body, IReadOnlyDictionary<string, string> Data);

public enum PushResult
{
    Sent,

    /// <summary>Nhà cung cấp báo token không còn hiệu lực (app bị gỡ, token hết hạn) — phải xóa khỏi danh sách.</summary>
    InvalidToken,
    Failed,
}

/// <summary>Cổng gửi push tới một thiết bị (FCM thật hoặc ghi log).</summary>
public interface IPushGateway
{
    Task<PushResult> SendAsync(PushMessage message);
}

/// <summary>
/// Chế độ <c>Push:Provider = log</c>: chỉ ghi log nội dung push (không ghi đủ token). Gửi FCM thật để đợt sau, khi có
/// service account.
/// </summary>
public sealed class LoggingPushGateway(ILogger<LoggingPushGateway> logger) : IPushGateway
{
    public Task<PushResult> SendAsync(PushMessage message)
    {
        logger.LogInformation(
            "[PUSH] token={Token}… title=\"{Title}\" body=\"{Body}\" data={Data}",
            message.Token[..Math.Min(8, message.Token.Length)],
            message.Title,
            message.Body,
            string.Join(", ", message.Data.Select(pair => $"{pair.Key}={pair.Value}")));
        return Task.FromResult(PushResult.Sent);
    }
}

/// <summary>
/// Đẩy thông báo gửi tới một tài khoản ra các thiết bị đã đăng ký. Chỉ gửi sau khi transaction nghiệp vụ commit (không
/// báo điều chưa xảy ra) và chạy nền, nên nhà cung cấp push chậm hay lỗi không làm chậm/hỏng thao tác của nhân viên.
/// </summary>
public sealed class PushDispatcher(TransactionRunner transactions, IServiceScopeFactory scopes, ILogger<PushDispatcher> logger)
{
    private const string DefaultTitle = "Soopi";

    private static readonly Dictionary<string, string> Titles = new()
    {
        ["TICKET_RECEIVED"] = "Đã tiếp nhận thiết bị",
        ["QUOTATION_AWAITING_CUSTOMER"] = "Báo giá chờ xác nhận",
        ["TICKET_COMPLETED"] = "Thiết bị đã sửa xong",
        ["TICKET_HANDED_OVER"] = "Đã bàn giao thiết bị",
        ["WARRANTY_REQUEST_CANCELLED"] = "Yêu cầu bảo hành đã bị hủy",
    };

    public void Dispatch(long accountId, long notificationId, string type, string message, string? entityId) =>
        transactions.AfterCommit(() => _ = Task.Run(() => DeliverAsync(accountId, notificationId, type, message, entityId)));

    private async Task DeliverAsync(long accountId, long notificationId, string type, string message, string? entityId)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var devices = scope.ServiceProvider.GetRequiredService<PushDeviceStore>();
            var gateway = scope.ServiceProvider.GetRequiredService<IPushGateway>();
            var data = new Dictionary<string, string> { ["notificationId"] = notificationId.ToString(), ["type"] = type };
            if (entityId is not null) data["entityId"] = entityId;
            foreach (var token in await devices.TokensOfAsync(accountId))
            {
                var result = await gateway.SendAsync(new PushMessage(token, Titles.GetValueOrDefault(type, DefaultTitle), message, data));
                if (result == PushResult.InvalidToken) await devices.DeleteTokenAsync(token);
            }
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Không gửi được push cho thông báo {NotificationId} ({Type})", notificationId, type);
        }
    }
}
