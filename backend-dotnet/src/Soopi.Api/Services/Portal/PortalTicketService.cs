using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Quotations;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Billing;
using Soopi.Api.Services.Quotations;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Portal;

public sealed record PortalStep(string Key, string Label, string State);

public sealed record PortalNote(DateTimeOffset At, string Text);

public sealed record PortalCosts(decimal InWarrantyAmount, decimal OutOfWarrantyParts, decimal ServiceFee, decimal Vat, decimal Total, string PaymentStatus);

public sealed record PortalQuotationLine(int LineNo, string? Description, int Quantity, decimal? UnitPrice, decimal? LaborFee, decimal? LineTotal);

public sealed record PendingQuotation(
    string Code, DateOnly? ValidUntil, decimal VatRate, IReadOnlyList<PortalQuotationLine> Lines, decimal PartsTotal, decimal LaborTotal, decimal GrandTotal);

/// <summary>
/// Dữ liệu phiếu cho cổng khách. POL-06: không có ghi chú nội bộ, kết quả kiểm tra, phân công, tên nhân viên, SLA nội bộ,
/// ghi chú duyệt giá hay giá vốn.
/// </summary>
public sealed record PortalTicketView(
    string Code, string? ProductName, string? BrandName, string? SerialOrImei, DateTimeOffset ReceivedAt, DateTimeOffset? PromisedReturnAt,
    string Status, bool Stopped, IReadOnlyList<PortalStep> Steps, IReadOnlyList<PortalNote> CustomerNotes, PortalCosts Costs,
    PendingQuotation? PendingQuotation, DateTimeOffset? HandedOverAt, int? Rating, bool CanRate)
{
    private static readonly string[] StepKeys = ["RECEIVED", "DIAGNOSIS", "AWAITING_PARTS", "REPAIRING", "QC", "READY"];
    private static readonly string[] StepLabels = ["Tiếp nhận", "Chẩn đoán", "Chờ linh kiện", "Đang sửa", "QC", "Sẵn sàng nhận máy"];

    public static PortalTicketView From(Ticket ticket, BillingBreakdown billing, Quotation? pending)
    {
        var device = ticket.DeviceSnapshot;
        var isDelivered = ticket.Status is TicketStatus.DELIVERED or TicketStatus.RETURNED_UNREPAIRED;
        return new PortalTicketView(
            ticket.Id, device.GetValueOrDefault("productName"), device.GetValueOrDefault("brandName"), device.GetValueOrDefault("serialOrImei"),
            ticket.ReceivedAt, ticket.PromisedReturnAt, ticket.Status.ToString(), IsStopped(ticket.Status), BuildSteps(ticket.Status),
            ticket.CustomerNotes.Select(note => new PortalNote(note.At, note.Text)).ToList(),
            new PortalCosts(billing.FreeWarrantyAmount, billing.PartsFee, billing.ServiceFee, billing.Vat, billing.Total, billing.PaymentStatus),
            pending is null
                ? null
                : new PendingQuotation(pending.Id, pending.ValidUntil, pending.VatRate,
                    pending.Lines.Select(line => new PortalQuotationLine(line.LineNo, line.Description, line.Quantity, line.UnitPrice, line.LaborFee, line.LineTotal)).ToList(),
                    pending.PartsTotal, pending.LaborTotal, pending.GrandTotal),
            ticket.Handover?.HandedOverAt,
            ticket.Handover?.Rating,
            isDelivered);
    }

    /// <summary>Bước hiện tại theo mục 11.2; StepKeys.Length nghĩa là mọi bước đã xong.</summary>
    public static int CurrentStep(TicketStatus status) => status switch
    {
        TicketStatus.RECEIVED => 0,
        TicketStatus.AWAITING_PARTS => 2,
        TicketStatus.REPAIRING => 3,
        TicketStatus.COMPLETED => 5,
        TicketStatus.DELIVERED => StepKeys.Length,
        _ => 1,
    };

    public static bool IsStopped(TicketStatus status) => status is TicketStatus.AWAITING_RETURN or TicketStatus.RETURNED_UNREPAIRED;

    private static List<PortalStep> BuildSteps(TicketStatus status)
    {
        var current = CurrentStep(status);
        return StepKeys.Select((key, index) => new PortalStep(key, StepLabels[index], index < current ? "DONE" : index == current ? "CURRENT" : "UPCOMING")).ToList();
    }
}

public sealed record PortalTicketSummary(string Code, string? ProductName, string? SerialOrImei, DateTimeOffset ReceivedAt, string Status, bool Stopped, int CurrentStep, int? Rating = null);

public sealed record DecisionRequest([NotNull] Decision? Decision, string? Reason);

public sealed record TicketRatingRequest([property: NotNull, Min(1), Max(5)] int? Rating, string? Comment);

public sealed class PortalTicketService(
    TicketStore tickets,
    QuotationStore quotations,
    BillingCalculator billing,
    CustomerDecisionService decisions,
    PortalPolicy policy,
    CurrentActor actors,
    TransactionRunner transactions,
    AuditService audit,
    TimeProvider clock)
{
    public async Task<PortalTicketView> TicketAsync(string code)
    {
        actors.RequireOrPortal(Permission.PORTAL_SELF);
        return await ViewAsync(await RequireTicketAsync(code));
    }

    public async Task<List<PortalTicketSummary>> MyTicketsAsync()
    {
        actors.Require(Permission.PORTAL_SELF);
        return (await tickets.FindByCustomerAsync(policy.RequireCustomerAccount()))
            .Select(ticket => new PortalTicketSummary(ticket.Id, ticket.DeviceSnapshot.GetValueOrDefault("productName"),
                ticket.DeviceSnapshot.GetValueOrDefault("serialOrImei"), ticket.ReceivedAt, ticket.Status.ToString(),
                PortalTicketView.IsStopped(ticket.Status), PortalTicketView.CurrentStep(ticket.Status),
                ticket.Handover?.Rating))
            .ToList();
    }

    /// <summary>Quyết định của khách (kênh PORTAL) cho báo giá đang chờ của đúng phiếu.</summary>
    public async Task<PortalTicketView> DecideQuotationAsync(string code, Decision? decision, string? reason)
    {
        actors.RequireOrPortal(Permission.PORTAL_SELF);
        var ticket = await RequireTicketAsync(code);
        if (ticket.ActiveQuotationId is null) throw new DomainException(ErrorCode.QUOTE_NOT_FOUND);
        await decisions.DecideAsCustomerAsync(ticket.ActiveQuotationId, decision, reason, CustomerActing(ticket));
        return await ViewAsync(await RequireTicketAsync(code));
    }

    /// <summary>Khách hàng gửi đánh giá và chấm điểm dịch vụ sau khi nhận máy (bàn giao).</summary>
    public async Task<PortalTicketView> RateTicketAsync(string code, int? rating, string? comment)
    {
        actors.RequireOrPortal(Permission.PORTAL_SELF);
        if (rating is null or < 1 or > 5) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var ticket = await RequireTicketAsync(code);
        if (ticket.Status is not (TicketStatus.DELIVERED or TicketStatus.RETURNED_UNREPAIRED))
            throw new DomainException(ErrorCode.TICKET_INVALID_STATE);

        var actor = CustomerActing(ticket);
        var now = clock.GetUtcNow();

        await transactions.InTransactionAsync(async () =>
        {
            ticket.UpdateRating(rating.Value);
            if (!string.IsNullOrWhiteSpace(comment))
            {
                var noteText = $"[Khách đánh giá {rating} sao]: {comment.Trim()}";
                ticket.AddCustomerNote(noteText, now, actor);
            }
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "TICKET_RATED",
                $"Đánh giá {rating} sao cho phiếu {code}", "TICKET", code, null, rating.ToString());
        });

        return await ViewAsync(await RequireTicketAsync(code));
    }

    /// <summary>Khách chỉ thấy phiếu của mình; portal token chỉ thấy đúng mã đã tra cứu; ngoài phạm vi → 404 (POL-03).</summary>
    private async Task<Ticket> RequireTicketAsync(string code)
    {
        var ticket = await tickets.FindAsync(code) ?? throw new DomainException(ErrorCode.TICKET_NOT_FOUND);
        var byToken = actors.PortalGrant?.AllowsTicket(code) == true;
        if (!byToken && !OwnsTicket(actors.Actor, ticket)) throw new DomainException(ErrorCode.TICKET_NOT_FOUND);
        return ticket;
    }

    /// <summary>Người quyết định báo giá / đánh giá: tài khoản khách, hoặc chủ phiếu đại diện bởi portal token (lịch sử ghi KH:mã).</summary>
    private AuthenticatedActor CustomerActing(Ticket ticket) =>
        actors.Actor is { } actor && OwnsTicket(actor, ticket)
            ? actor
            : new AuthenticatedActor(null, "portal", new HashSet<Role> { Role.CUSTOMER }, RolePermissions.ForRole(Role.CUSTOMER), null, ticket.CustomerId,
                ticket.CustomerSnapshot.GetValueOrDefault("fullName", "Khách hàng"));

    private static bool OwnsTicket(AuthenticatedActor? actor, Ticket ticket) =>
        actor is not null && actor.Roles.Contains(Role.CUSTOMER) && actor.CustomerId is not null && actor.CustomerId == ticket.CustomerId;

    private async Task<PortalTicketView> ViewAsync(Ticket ticket)
    {
        Quotation? pending = null;
        if (ticket.Status == TicketStatus.AWAITING_CUSTOMER_CONFIRMATION && ticket.ActiveQuotationId is not null
            && await quotations.FindAsync(ticket.ActiveQuotationId) is { Approval.Status: "APPROVED", CustomerDecision.Status: "PENDING" } quote)
            pending = quote;
        return PortalTicketView.From(ticket, await billing.BreakdownAsync(ticket.Id), pending);
    }
}
