using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Customers;

namespace Soopi.Api.Services.Tickets;

public sealed record CustomerSummary(string Code, string? FullName, string? Phone, string? Email, string? Address);

public sealed record SlaView(string Level, DateTimeOffset DueAt, string Status, long HoursInProcess);

public sealed record TicketView(
    string Code,
    string StationCode,
    DateTimeOffset ReceivedAt,
    string Channel,
    string RequestType,
    string? WarrantyRequestCode,
    CustomerSummary? Customer,
    string DeviceCode,
    IReadOnlyDictionary<string, string> Device,
    WarrantyAtIntake WarrantyAtIntake,
    string? SealCondition,
    Cosmetic Cosmetic,
    string ReportedIssue,
    DateTimeOffset? PromisedReturnAt,
    decimal EstimatedCost,
    SlaView Sla,
    string Status,
    Assignment? Assignment,
    string? TechnicianName,
    Inspection? Inspection,
    RepairOrder? RepairOrder,
    string? ActiveQuotationCode,
    Handover? Handover,
    IReadOnlyList<Note> CustomerNotes,
    IReadOnlyList<Note> InternalNotes,
    long? Version)
{
    public static TicketView From(Ticket ticket, CustomerProjection projection, DateTimeOffset now, TimeSpan atRiskThreshold,
        IReadOnlyDictionary<string, string> employeeNames)
    {
        var snapshot = ticket.CustomerSnapshot;
        var customer = projection switch
        {
            CustomerProjection.FULL or CustomerProjection.CONTACT => new CustomerSummary(ticket.CustomerId, snapshot.GetValueOrDefault("fullName"),
                snapshot.GetValueOrDefault("phone"), snapshot.GetValueOrDefault("email"), snapshot.GetValueOrDefault("address")),
            CustomerProjection.LIMITED => new CustomerSummary(ticket.CustomerId, snapshot.GetValueOrDefault("fullName"), Mask(snapshot.GetValueOrDefault("phone")), null, null),
            _ => null,
        };
        var dueAt = ticket.Sla.DueAt;
        var slaStatus = now > dueAt ? "BREACHED" : now + atRiskThreshold > dueAt ? "AT_RISK" : "ON_TRACK";
        return new TicketView(
            ticket.Id, ticket.StationCode, ticket.ReceivedAt, ticket.Channel.ToString(), ticket.RequestType.ToString(), ticket.WarrantyRequestId,
            customer, ticket.DeviceId, ticket.DeviceSnapshot, ticket.WarrantyAtIntake, ticket.SealCondition, ticket.Cosmetic, ticket.ReportedIssue,
            ticket.PromisedReturnAt, ticket.EstimatedCost,
            new SlaView(ticket.Sla.Level.ToString(), dueAt, slaStatus, Math.Max(0, (long)(now - ticket.ReceivedAt).TotalHours)),
            ticket.Status.ToString(), ticket.Assignment,
            ticket.Assignment is null ? null : employeeNames.GetValueOrDefault(ticket.Assignment.TechnicianId),
            ticket.Inspection, ticket.RepairOrder, ticket.ActiveQuotationId, ticket.Handover, ticket.CustomerNotes, ticket.InternalNotes, ticket.Version);
    }

    private static string Mask(string? phone) => phone is null || phone.Length < 7 ? "***" : phone[..4] + "***" + phone[^3..];
}

public sealed record HistoryView(IReadOnlyList<StatusHistory> StatusHistory, IReadOnlyList<Dictionary<string, object?>> Audit);

public sealed record ReceiptView(TicketView Ticket, string Title);

public sealed class TicketQueryService(TicketStore tickets, Sql sql, CurrentActor actors, StaffDirectory staff, TimeProvider clock, IConfiguration configuration)
{
    private static readonly HashSet<string> SlaFilters = ["BREACHED", "AT_RISK", "ON_TRACK"];

    public TimeSpan AtRiskThreshold => configuration.GetValue("Sla:AtRiskThreshold", TimeSpan.FromHours(2));

    public async Task<PageResponse<TicketView>> SearchAsync(
        string? status, string? category, string? technician, string? sla, string? query, DateTimeOffset? from, DateTimeOffset? to, int page, int size)
    {
        var actor = actors.Require(Permission.TICKET_READ_ALL, Permission.TICKET_READ_ASSIGNED);
        new PageRequestParams(page, size, null).Validate();
        if (sla is not null && !SlaFilters.Contains(sla)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var effectiveTechnician = actor.Permissions.Contains(Permission.TICKET_READ_ALL) ? technician : actor.EmployeeId;
        var filter = Filter(status, category, effectiveTechnician, sla, query, from, to);
        var total = await tickets.CountAsync(filter);
        var items = await ViewsAsync(await tickets.SearchAsync(filter, page * size, size), actor);
        return PageResponse<TicketView>.Of(items, page, size, total);
    }

    public async Task<TicketView> GetAsync(string code)
    {
        var actor = actors.Require(Permission.TICKET_READ_ALL, Permission.TICKET_READ_ASSIGNED);
        return await ViewAsync(await RequireReadableAsync(code, actor), actor);
    }

    public async Task<List<TicketView>> OpenAsync()
    {
        var actor = actors.Require(Permission.TICKET_READ_ALL);
        return await ViewsAsync(await tickets.FindOpenAsync(), actor);
    }

    public async Task<HistoryView> HistoryAsync(string code)
    {
        var actor = actors.Require(Permission.TICKET_READ_ALL, Permission.TICKET_READ_ASSIGNED);
        var ticket = await RequireReadableAsync(code, actor);
        var audit = await sql.QueryAsync(
            "SELECT ThoiGian, MaNguoiThaoTac, TenNguoiThaoTac, VaiTro, HanhDong, NhanHanhDong, GiaTriTruoc, GiaTriSau FROM NhatKyThaoTac "
            + "WHERE LoaiDoiTuong = 'TICKET' AND MaDoiTuong = ? ORDER BY ThoiGian, MaNhatKy",
            row => new Dictionary<string, object?>
            {
                ["at"] = row.Time("ThoiGian"),
                ["actorId"] = row.Str("MaNguoiThaoTac"),
                ["actorName"] = row.Str("TenNguoiThaoTac"),
                ["actorRoles"] = string.IsNullOrWhiteSpace(row.Str("VaiTro")) ? new List<string>() : row.Str("VaiTro")!.Split(',').ToList(),
                ["action"] = row.Str("HanhDong"),
                ["actionLabel"] = row.Str("NhanHanhDong"),
                ["entityType"] = "TICKET",
                ["entityId"] = code,
                ["before"] = row.Str("GiaTriTruoc"),
                ["after"] = row.Str("GiaTriSau"),
            },
            code);
        return new HistoryView(ticket.StatusHistory, audit);
    }

    public async Task<ReceiptView> ReceiptAsync(string code)
    {
        var actor = actors.Require(Permission.TICKET_READ_ALL);
        return new ReceiptView(await ViewAsync(await RequireAsync(code), actor), "PHIẾU TIẾP NHẬN");
    }

    public async Task<List<TicketView>> ByCustomerAsync(string customerCode)
    {
        var actor = actors.Require(Permission.CUSTOMER_READ_CONTACT);
        return await ViewsAsync(await tickets.FindByCustomerAsync(customerCode), actor);
    }

    public TicketFilter Filter(string? status, string? category, string? technician, string? sla, string? query, DateTimeOffset? from, DateTimeOffset? to)
    {
        var now = clock.GetUtcNow();
        return new TicketFilter(status, category, technician, sla, query, from, to, now, now + AtRiskThreshold);
    }

    public async Task<TicketView> ViewAsync(Ticket ticket, AuthenticatedActor actor) => (await ViewsAsync([ticket], actor))[0];

    public async Task<List<TicketView>> ViewsAsync(IEnumerable<Ticket> list, AuthenticatedActor actor)
    {
        var names = await staff.EmployeeNamesAsync();
        var projection = CustomerView.ProjectionFor(actor);
        var now = clock.GetUtcNow();
        return list.Select(ticket => TicketView.From(ticket, projection, now, AtRiskThreshold, names)).ToList();
    }

    public async Task<Ticket> RequireAsync(string code) => await tickets.FindAsync(code) ?? throw new DomainException(ErrorCode.TICKET_NOT_FOUND);

    private async Task<Ticket> RequireReadableAsync(string code, AuthenticatedActor actor)
    {
        var ticket = await RequireAsync(code);
        if (actor.Permissions.Contains(Permission.TICKET_READ_ALL)) return ticket;
        if (actor.Permissions.Contains(Permission.TICKET_READ_ASSIGNED) && ticket.Assignment?.TechnicianId == actor.EmployeeId) return ticket;
        throw new DomainException(ErrorCode.TICKET_NOT_FOUND);
    }
}
