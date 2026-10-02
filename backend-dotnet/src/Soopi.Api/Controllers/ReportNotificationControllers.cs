using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Notifications;
using Soopi.Api.Services.Reporting;

namespace Soopi.Api.Controllers;

public sealed record DeviceRegistration([NotBlank] string Platform, [NotBlank] string PushToken, string? AppVersion);

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
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
