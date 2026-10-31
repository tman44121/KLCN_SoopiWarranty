using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Services.Reporting;

namespace Soopi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/access")]
public sealed class AccessTrackingController(AccessTrackingService tracking) : ControllerBase
{
    [HttpPost("heartbeat")]
    public async Task<object> Heartbeat() => new { tracked = await tracking.HeartbeatAsync() };
}

[ApiController]
[Authorize(Roles = "ADMIN")]
[Route("api/v1/admin/access")]
public sealed class AccessStatisticsController(AccessStatisticsService stats) : ControllerBase
{
    [HttpGet("summary")]
    public Task<AccessSummary> Summary([FromQuery] AccessFilters filter) => stats.SummaryAsync(filter);

    [HttpGet("online")]
    public Task<PageResponse<OnlineAccount>> Online([FromQuery] AccessFilters filter, [FromQuery] int page = 0, [FromQuery] int size = 25) => stats.OnlineAsync(filter, page, size);

    [HttpGet("logs")]
    public Task<PageResponse<AccessLog>> Logs([FromQuery] AccessFilters filter, [FromQuery] string? action, [FromQuery] int page = 0, [FromQuery] int size = 25) => stats.LogsAsync(filter, action, page, size);

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] AccessFilters filter, [FromQuery] string? action) =>
        File(await stats.ExportAsync(filter, action), ReportWorkbook.ContentType, "soopi-truy-cap.xlsx");
}
