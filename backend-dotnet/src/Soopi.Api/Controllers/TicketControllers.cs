using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Tickets;

namespace Soopi.Api.Controllers;

public sealed record CosmeticRequest(
    string? Scratches, bool Dents, bool Cracks, string? Moisture, string? Accessories, string? AccessoriesNote, string? Notes, bool CustomerAcknowledged);

public sealed record ReceiveTicketRequest(
    [NotNull] CustomerInput? Customer,
    [NotNull] DeviceInput? Device,
    string? WarrantyRequestCode,
    Channel? Channel,
    RequestType? RequestType,
    string? SealCondition,
    [NotNull] CosmeticRequest? Cosmetic,
    [NotBlank] string ReportedIssue,
    DateTimeOffset? PromisedReturnAt,
    [PositiveOrZero] decimal? EstimatedCost,
    SlaLevel? SlaLevel);

public sealed record AssignRequest([NotBlank] string TechnicianId, Priority? Priority, string? Note);

public sealed record ReassignRequest([NotBlank] string TechnicianId, string? Note);

public sealed record NoteRequest([NotBlank] string Text);

public sealed record InspectionRequest(
    [NotBlank] string Findings,
    List<ChecklistItem?>? Checklist,
    bool WaterDamage,
    [NotNull] WarrantyClassification? Classification,
    string? OutOfWarrantyReason,
    string? ProposedFix,
    string? ReclassNote)
{
    public InspectionInput Input() => new(Findings, Checklist, WaterDamage, Classification, OutOfWarrantyReason, ProposedFix, ReclassNote);
}

[ApiController]
[Authorize]
[Route("api/v1/tickets")]
public sealed class TicketsController(
    ReceptionService reception,
    AssignmentService assignments,
    TicketQueryService tickets,
    TechnicianQueryService technicians,
    InspectionService inspections,
    RepairService repairs,
    TicketNoteService notes) : ControllerBase
{
    [HttpGet]
    public Task<PageResponse<TicketView>> Search(
        [FromQuery] string? status, [FromQuery] string? category, [FromQuery] string? technician, [FromQuery] string? sla, [FromQuery] string? q,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] int page = 0, [FromQuery] int size = 25) =>
        tickets.SearchAsync(status, category, technician, sla, q, from, to, page, size);

    [HttpGet("open")]
    public Task<List<TicketView>> Open() => tickets.OpenAsync();

    [HttpPost]
    public async Task<IActionResult> Receive([FromBody] ReceiveTicketRequest body)
    {
        var cosmetic = body.Cosmetic!;
        var command = new ReceiveCommand(
            body.Customer!, body.Device!, body.WarrantyRequestCode, body.Channel, body.RequestType, body.SealCondition,
            new Cosmetic(cosmetic.Scratches ?? "NONE", cosmetic.Dents, cosmetic.Cracks, cosmetic.Moisture ?? "NONE", cosmetic.Accessories ?? "COMPLETE",
                cosmetic.AccessoriesNote, cosmetic.Notes, cosmetic.CustomerAcknowledged),
            body.ReportedIssue, body.PromisedReturnAt, body.EstimatedCost, body.SlaLevel);
        return StatusCode(StatusCodes.Status201Created, await reception.ReceiveAsync(command));
    }

    [HttpGet("{code}")]
    public Task<TicketView> Get(string code) => tickets.GetAsync(code);

    [HttpGet("{code}/history")]
    public Task<HistoryView> History(string code) => tickets.HistoryAsync(code);

    [HttpGet("{code}/receipt")]
    public Task<ReceiptView> Receipt(string code) => tickets.ReceiptAsync(code);

    [HttpGet("{code}/assignment-candidates")]
    public Task<List<CandidateView>> Candidates(string code) => technicians.CandidatesAsync(code);

    [HttpPost("{code}/assignment")]
    public Task<TicketView> Assign(string code, [FromBody] AssignRequest body) => assignments.AssignAsync(code, body.TechnicianId, body.Priority, body.Note);

    [HttpPut("{code}/assignment")]
    public Task<TicketView> Reassign(string code, [FromBody] ReassignRequest body) => assignments.ReassignAsync(code, body.TechnicianId, body.Note);

    [HttpPost("{code}/inspection")]
    public Task<TicketView> Inspect(string code, [FromBody] InspectionRequest body) => inspections.RecordAsync(code, body.Input());

    [HttpPut("{code}/inspection")]
    public Task<TicketView> ReviseInspection(string code, [FromBody] InspectionRequest body) => inspections.ReviseAsync(code, body.Input());

    [HttpPost("{code}/repair/start")]
    public Task<TicketView> StartFreeRepair(string code) => repairs.StartFreeRepairAsync(code);

    [HttpPost("{code}/repair/parts-ready")]
    public Task<TicketView> ConfirmPartsReady(string code) => repairs.ConfirmPartsReadyAsync(code);

    [HttpPost("{code}/repair/results")]
    public Task<TicketView> RecordRepairResult(string code, [FromBody] RepairResultRequest body) => repairs.RecordResultAsync(code, body);

    [HttpPost("{code}/customer-notes")]
    public Task<TicketView> AddCustomerNote(string code, [FromBody] NoteRequest body) => notes.AddCustomerNoteAsync(code, body.Text);

    [HttpPost("{code}/internal-notes")]
    public Task<TicketView> AddInternalNote(string code, [FromBody] NoteRequest body) => notes.AddInternalNoteAsync(code, body.Text);
}

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class TechniciansAndSearchController(TechnicianQueryService technicians, TicketQueryService tickets, GlobalSearchService search) : ControllerBase
{
    [HttpGet("technicians/workload")]
    public Task<List<WorkloadView>> Workload() => technicians.WorkloadAsync();

    [HttpGet("technicians/me/queue")]
    public Task<List<TicketView>> MyQueue() => technicians.MyQueueAsync();

    [HttpGet("customers/{customerCode}/tickets")]
    public Task<List<TicketView>> CustomerTickets(string customerCode) => tickets.ByCustomerAsync(customerCode);

    [HttpGet("search")]
    public Task<SearchResult> Search([FromQuery] string q) => search.SearchAsync(q);
}
