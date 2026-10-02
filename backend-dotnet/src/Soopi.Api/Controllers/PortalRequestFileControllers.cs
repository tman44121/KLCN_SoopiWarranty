using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Files;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.WarrantyRequests;

namespace Soopi.Api.Controllers;

public sealed record LookupRequest([NotBlank] string Code, [NotBlank] string Phone);

public sealed record SubmittedRequest(string Code);

public sealed record CancelRequest([NotBlank] string Reason);

[ApiController]
[Authorize]
[Route("api/v1/portal")]
public sealed class PortalController(
    PortalAccessService access, PortalWarrantyRequestService requests, PortalProfileService profiles, PortalTicketService tickets, CurrentActor actors)
    : ControllerBase
{
    [HttpGet("tickets/{code}")]
    public Task<PortalTicketView> Ticket(string code) => tickets.TicketAsync(code);

    [HttpPost("tickets/{code}/quotation-decision")]
    public Task<PortalTicketView> Decide(string code, [FromBody] DecisionRequest body) => tickets.DecideQuotationAsync(code, body.Decision, body.Reason);

    [HttpGet("my/tickets")]
    public Task<List<PortalTicketSummary>> MyTickets() => tickets.MyTicketsAsync();

    [HttpGet("catalog")]
    [AllowAnonymous]
    public Task<PortalCatalog> Catalog() => access.CatalogAsync();

    [HttpPost("lookup")]
    [AllowAnonymous]
    public Task<LookupResult> Lookup([FromBody] LookupRequest body) => access.LookupAsync(body.Code, body.Phone, actors.ClientIp);

    [HttpPost("warranty-requests")]
    [AllowAnonymous]
    public async Task<IActionResult> Submit()
    {
        var data = await MultipartJson.ReadAsync<WarrantyRequestData>(Request);
        var code = await requests.SubmitAsync(data, await MultipartJson.FilesAsync(Request, "files"), actors.ClientIp);
        return StatusCode(StatusCodes.Status201Created, new SubmittedRequest(code));
    }

    [HttpGet("warranty-requests/{code}")]
    public Task<RequestView> WarrantyRequest(string code) => requests.GetAsync(code);

    [HttpGet("my/profile")]
    public Task<Profile> MyProfile() => profiles.ProfileAsync();

    [HttpPatch("my/profile")]
    public Task<Profile> UpdateMyProfile([FromBody] ProfileUpdate body) => profiles.UpdateContactAsync(body);

    [HttpGet("my/devices")]
    public Task<List<OwnedDevice>> MyDevices() => profiles.DevicesAsync();

    [HttpGet("my/warranty-requests")]
    public Task<List<RequestSummary>> MyWarrantyRequests() => requests.MineAsync();

    [HttpGet("my/warranty-requests/{code}")]
    public Task<RequestView> MyWarrantyRequest(string code) => requests.GetAsync(code);

    [HttpPost("my/warranty-requests")]
    public async Task<IActionResult> SubmitMine()
    {
        var data = await MultipartJson.ReadAsync<OwnWarrantyRequestData>(Request);
        var code = await requests.SubmitOwnAsync(data, await MultipartJson.FilesAsync(Request, "files"));
        return StatusCode(StatusCodes.Status201Created, new SubmittedRequest(code));
    }
}

[ApiController]
[Authorize]
[Route("api/v1/warranty-requests")]
public sealed class WarrantyRequestsController(WarrantyRequestService requests) : ControllerBase
{
    [HttpGet]
    public Task<List<Dictionary<string, object?>>> Search([FromQuery] string status = "PENDING_INTAKE", [FromQuery] string? q = null) =>
        requests.SearchAsync(status, q);

    [HttpGet("{code}")]
    public Task<Dictionary<string, object?>> Get(string code) => requests.GetAsync(code);

    [HttpPost("{code}/cancel")]
    public Task<Dictionary<string, object?>> Cancel(string code, [FromBody] CancelRequest body) => requests.CancelAsync(code, body.Reason);
}

[ApiController]
[Authorize]
[Route("api/v1/files")]
public sealed class FilesController(AttachmentService attachments) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> Download(string id)
    {
        var file = await attachments.DownloadAsync(id);
        var disposition = new ContentDispositionHeaderValue("inline");
        disposition.SetHttpFileName(file.FileName);
        Response.Headers.ContentDisposition = disposition.ToString();
        Response.Headers.CacheControl = "private, no-store";
        return File(file.Content, file.ContentType);
    }
}
