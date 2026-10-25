using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Notifications;
using Soopi.Api.Services.Reporting;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Controllers;

public sealed record DeviceRegistration([NotBlank] string Platform, [NotBlank] string PushToken, string? AppVersion);

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
    [HttpGet("customer-reviews")]
    [Authorize(Roles = "ADMIN")]
    public Task<CustomerReviewReport> CustomerReviews([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station,
        [FromQuery] int? rating, [FromQuery] string? q, [FromQuery] int page = 0, [FromQuery] int size = 25) =>
        reports.CustomerReviewsAsync(from, to, station, rating, q, page, size);

    [HttpGet("export")]
    public async Task<FileContentResult> Export([FromQuery, BindRequired] DateOnly from, [FromQuery, BindRequired] DateOnly to, [FromQuery] string? station)
    {
        var content = await reports.ExportAsync(from, to, station);
        Response.Headers.CacheControl = "no-store";
        return File(content, ReportWorkbook.ContentType, $"soopi-bao-cao-{from:yyyy-MM-dd}-{to:yyyy-MM-dd}.xlsx");
    }

    [HttpGet("revenue-monthly")]
    public Task<List<MonthlyRevenue>> RevenueMonthly([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station) =>
        reports.RevenueMonthlyAsync(from, to, station);

    [HttpGet("technician-performance")]
    public Task<List<TechnicianPerformance>> TechnicianPerformance([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station) =>
        reports.TechnicianPerformanceAsync(from, to, station);

    [HttpGet("turnaround")]
    public Task<Turnaround> Turnaround([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station) =>
        reports.TurnaroundAsync(from, to, station);

    [HttpGet("warranty-ratio")]
    public Task<WarrantyRatio> WarrantyRatio([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station) =>
        reports.WarrantyRatioAsync(from, to, station);

    [HttpGet("repeat-repairs")]
    public Task<List<RepeatRepair>> RepeatRepairs([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station) =>
        reports.RepeatRepairsAsync(from, to, station);

    [HttpGet("quotation-reconciliation")]
    public Task<List<QuotationMismatch>> QuotationReconciliation() => reports.QuotationReconciliationAsync();

    [HttpGet("tickets-by-status")]
    public Task<List<StatusCount>> TicketsByStatus([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? station) =>
        reports.TicketsByStatusAsync(from, to, station);

    [HttpGet("sla-distribution")]
    public Task<List<SlaBucket>> SlaDistribution() => reports.SlaDistributionAsync();
}

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class AuditAndNotificationsController(AuditQueryService audits, NotificationQueryService notifications, PushDeviceService pushDevices) : ControllerBase
{
    [HttpGet("audit-logs")]
    public Task<PageResponse<AuditEntryView>> AuditLogs(
        [FromQuery] string? entityType, [FromQuery] string? entityId, [FromQuery] string? actor, [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to, [FromQuery] int page = 0, [FromQuery] int size = 25, [FromQuery] string? sort = null) =>
        audits.SearchAsync(entityType, entityId, actor, from, to, new PageRequestParams(page, size, sort));

    [HttpGet("notifications")]
    public Task<Inbox> Inbox([FromQuery] bool unread = false) => notifications.InboxAsync(unread);

    [HttpPost("notifications/{id}/read")]
    public async Task<IActionResult> MarkRead(string id)
    {
        await notifications.MarkReadAsync(id);
        return NoContent();
    }

    [HttpPost("notifications/read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await notifications.MarkAllReadAsync();
        return NoContent();
    }

    /// <summary>App di động đăng ký FCM token cho lượt cài app; gọi lặp lại an toàn.</summary>
    [HttpPut("notifications/devices/{installationId}")]
    public async Task<IActionResult> RegisterDevice(string installationId, [FromBody] DeviceRegistration body)
    {
        await pushDevices.RegisterAsync(installationId, body.Platform, body.PushToken, body.AppVersion);
        return NoContent();
    }

    [HttpDelete("notifications/devices/{installationId}")]
    public async Task<IActionResult> UnregisterDevice(string installationId)
    {
        await pushDevices.UnregisterAsync(installationId);
        return NoContent();
    }
}

/// <summary>Request body cho endpoint phát thông báo thủ công tới khách hàng.</summary>
public sealed record BroadcastRequest(
    [NotBlank, MaxLength(255)] string Message,
    [MaxLength(255)] string? Link = null,
    [MaxLength(20)] string? CustomerId = null,
    [MaxLength(22000)] string? CustomerIds = null
) : IValidatableObject
{
    public string[] Recipients() => (CustomerIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Concat(CustomerId is null ? [] : new[] { CustomerId.Trim() }).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if ((CustomerId is not null || CustomerIds is not null)
            && (Recipients().Length == 0 || Recipients().Any(id => id.Length is 0 or > 20)))
            yield return new ValidationResult("Chọn ít nhất một mã khách hàng hợp lệ (tối đa 20 ký tự mỗi mã).", [nameof(CustomerIds)]);
        var link = Link?.Trim();
        if (!string.IsNullOrEmpty(link) && (!link.StartsWith('/') || link.StartsWith("//") || link.Contains('\\') || link.Any(char.IsControl)))
            yield return new ValidationResult("Đường dẫn phải nằm trong website, ví dụ /account#lich-su.", [nameof(Link)]);
    }
}

[ApiController]
[Authorize(Roles = "ADMIN,RECEPTIONIST")]
[Route("api/v1/admin/notifications")]
public sealed class NotificationBroadcastController(NotificationService notifications) : ControllerBase
{
    /// <summary>
    /// Phát thông báo thủ công (CUSTOM_ANNOUNCEMENT) tới khách hàng.
    /// • Không truyền CustomerId/CustomerIds → gửi tất cả khách đang ACTIVE.
    /// • CustomerIds có giá trị → chỉ gửi cho các khách trong danh sách (phân cách bằng dấu phẩy).
    /// </summary>
    [HttpPost("broadcast")]
    public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest body)
    {
        var message = body.Message.Trim();
        var link = string.IsNullOrWhiteSpace(body.Link) ? null : body.Link.Trim();

        if (body.CustomerId is null && body.CustomerIds is null)
        {
            await notifications.BroadcastToAllCustomersAsync(message, link);
        }
        else
        {
            await notifications.BroadcastToCustomersAsync(body.Recipients(), message, link);
        }

        return NoContent();
    }
}
