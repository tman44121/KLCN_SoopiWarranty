using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Quotations;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Tickets;

namespace Soopi.Api.Services.Quotations;

public sealed record QuotationView(
    string Code, string TicketCode, string? InspectionCode, string CreatedBy, DateTimeOffset CreatedAt, DateOnly? ValidUntil, decimal VatRate,
    string? ServiceFeeCode, IReadOnlyList<QuotationLine> Lines, decimal PartsTotal, decimal LaborTotal, decimal GrandTotal, Approval Approval,
    CustomerDecision CustomerDecision, bool Active, long? Version)
{
    public static QuotationView From(Quotation q) =>
        new(q.Id, q.TicketId, q.InspectionCode, q.CreatedBy, q.CreatedAt, q.ValidUntil, q.VatRate, q.ServiceFeeCode, q.Lines, q.PartsTotal,
            q.LaborTotal, q.GrandTotal, q.Approval, q.CustomerDecision, q.Active, null);
}

public sealed record LineRequest(string? Sku, string? Description, [Positive] int? Quantity, [PositiveOrZero] decimal? UnitPrice, [PositiveOrZero] decimal? LaborFee);

public sealed record QuotationRequest(
    DateOnly? ValidUntil, [DecimalMin("0.00"), DecimalMax("100.00")] decimal? VatRate, string? ServiceFeeCode, [NotEmpty] List<LineRequest?>? Lines);

public sealed record LinesRequest([NotEmpty] List<LineRequest?>? Lines);

public sealed class QuotationService(
    QuotationStore quotations, Sql sql, TicketStore tickets, TicketQueryService ticketViews, StaffDirectory staff, CodeGenerator codes,
    CurrentActor actors, TransactionRunner transactions, AuditService audit, NotificationService notifications, TimeProvider clock)
{
    public Task<QuotationView> CreateAsync(string ticketCode, QuotationRequest command)
    {
        actors.Require(Permission.QUOTE_CREATE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await TechnicianAsync();
            var ticket = await ticketViews.RequireAsync(ticketCode);
            if (await quotations.HasActiveForTicketAsync(ticketCode)) throw new DomainException(ErrorCode.QUOTE_ACTIVE_EXISTS);
            var now = clock.GetUtcNow();
            var code = await codes.NextAsync(BusinessCodeType.Quotation);
            var quotation = new Quotation(code, ticketCode, ticket.Inspection?.Code, actor.EmployeeId!, now, DbTime.Date(now), command.ValidUntil,
                command.VatRate, command.ServiceFeeCode, await LinesAsync(command.Lines));
            ticket.MarkQuotationPending(code, now, actor);
            await quotations.SaveAsync(quotation);
            await tickets.SaveAsync(ticket);
            await AuditAsync(actor, "QUOTATION_CREATED", "Lập báo giá", code, null, ticketCode + " — " + quotation.GrandTotal);
            await notifications.ForRoleAsync("DISPATCHER", "QUOTATION_PENDING", $"Báo giá {code} đang chờ phê duyệt.", "/dispatch#quotes", code);
            return QuotationView.From(quotation);
        });
    }

    public Task<QuotationView> UpdateLinesAsync(string code, List<LineRequest?>? lines)
    {
        actors.Require(Permission.QUOTE_CREATE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await TechnicianAsync();
            var quotation = await RequireAsync(code);
            var ticket = await ticketViews.RequireAsync(quotation.TicketId);
            if (actor.EmployeeId != quotation.CreatedBy || ticket.Assignment?.TechnicianId != actor.EmployeeId)
                throw new DomainException(ErrorCode.NOT_ASSIGNED_TECHNICIAN);
            var before = quotation.GrandTotal.ToString(System.Globalization.CultureInfo.InvariantCulture);
            quotation.UpdateLines(await LinesAsync(lines));
            await quotations.SaveAsync(quotation);
            await AuditAsync(actor, "QUOTATION_LINES_UPDATED", "Cập nhật chi tiết báo giá", code, before,
                quotation.GrandTotal.ToString(System.Globalization.CultureInfo.InvariantCulture));
            return QuotationView.From(quotation);
        });
    }

    public async Task<PageResponse<QuotationView>> SearchAsync(string? approvalStatus, int page, int size)
    {
        actors.Require(Permission.QUOTE_REVIEW);
        new PageRequestParams(page, size, null).Validate();
        var status = approvalStatus ?? "PENDING";
        var total = await quotations.CountByApprovalStatusAsync(status);
        var items = (await quotations.FindByApprovalStatusAsync(status, page * size, size)).Select(QuotationView.From).ToList();
        return PageResponse<QuotationView>.Of(items, page, size, total);
    }

    public async Task<QuotationView> GetAsync(string code)
    {
        var actor = actors.Require(Permission.QUOTE_REVIEW, Permission.QUOTE_CREATE, Permission.TICKET_READ_ALL);
        var quotation = await RequireAsync(code);
        if (actor.Permissions.Contains(Permission.QUOTE_REVIEW) || actor.Permissions.Contains(Permission.TICKET_READ_ALL)) return QuotationView.From(quotation);
        var ticket = await ticketViews.RequireAsync(quotation.TicketId);
        return ticket.Assignment?.TechnicianId == actor.EmployeeId ? QuotationView.From(quotation) : throw new DomainException(ErrorCode.QUOTE_NOT_FOUND);
    }

    public async Task<Quotation> RequireAsync(string code) => await quotations.FindAsync(code) ?? throw new DomainException(ErrorCode.QUOTE_NOT_FOUND);

    private async Task<List<QuotationLine?>> LinesAsync(List<LineRequest?>? input)
    {
        if (input is null || input.Count == 0) throw new DomainException(ErrorCode.QUOTE_LINES_REQUIRED);
        var result = new List<QuotationLine?>();
        for (var index = 0; index < input.Count; index++)
        {
            var value = input[index] ?? throw new DomainException(ErrorCode.QUOTE_LINE_INVALID);
            (string Sku, string Name, decimal ServicePrice)? part = null;
            if (!JavaText.IsBlank(value.Sku))
            {
                var found = await sql.FirstOrDefaultAsync("SELECT MaLK, TenLK, DonGiaDichVu FROM LinhKien WHERE MaLK = ?",
                    row => (Sku: row.Str("MaLK")!, Name: row.Str("TenLK")!, ServicePrice: SqlMoney.Read(row.Dec("DonGiaDichVu"))), JavaText.Trim(value.Sku));
                part = found.Sku is null ? throw new DomainException(ErrorCode.QUOTE_PART_NOT_FOUND) : found;
            }
            var description = JavaText.IsBlank(value.Description) ? part?.Name : value.Description;
            result.Add(QuotationLine.Of(index + 1, part?.Sku, description, value.Quantity ?? 1, value.UnitPrice ?? part?.ServicePrice, value.LaborFee ?? 0));
        }
        return result;
    }

    private async Task<AuthenticatedActor> TechnicianAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.TECHNICIAN);
        return actor;
    }

    private Task AuditAsync(AuthenticatedActor actor, string action, string label, string entityId, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "QUOTATION", entityId, before, after);
}

public sealed class QuotationReviewService(
    QuotationStore quotations, QuotationService views, TicketStore tickets, TicketQueryService ticketViews, StaffDirectory staff, CurrentActor actors,
    TransactionRunner transactions, AuditService audit, NotificationService notifications, TimeProvider clock)
{
    public Task<QuotationView> ApproveAsync(string code, string? note)
    {
        actors.Require(Permission.QUOTE_REVIEW);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await DispatcherAsync();
            var quotation = await views.RequireAsync(code);
            var ticket = await ticketViews.RequireAsync(quotation.TicketId);
            var now = clock.GetUtcNow();
            quotation.Approve(actor.EmployeeId!, note, now);
            ticket.ApproveQuotation(code, now, actor);
            await quotations.SaveAsync(quotation);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "QUOTATION_APPROVED", "Phê duyệt báo giá", "QUOTATION", code, "PENDING", "APPROVED");
            await notifications.ForRoleAsync("RECEPTIONIST", "QUOTATION_APPROVED", $"Báo giá {code} đã được duyệt, chờ khách xác nhận.", "/receptionist", code);
            // App khách mở theo mã phiếu nên entityId là mã phiếu, không phải mã báo giá.
            await notifications.ForCustomerAsync(ticket.CustomerId, "QUOTATION_AWAITING_CUSTOMER",
                $"Báo giá {code} cho phiếu {ticket.Id} đang chờ xác nhận.", ticket.Id);
            return QuotationView.From(quotation);
        });
    }

    public Task<QuotationView> RejectAsync(string code, string note)
    {
        actors.Require(Permission.QUOTE_REVIEW);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await DispatcherAsync();
            var quotation = await views.RequireAsync(code);
            var ticket = await ticketViews.RequireAsync(quotation.TicketId);
            var now = clock.GetUtcNow();
            quotation.Reject(actor.EmployeeId!, note, now);
            ticket.RejectQuotation(code, now, actor);
            await quotations.SaveAsync(quotation);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "QUOTATION_REJECTED", "Yêu cầu sửa lại báo giá", "QUOTATION", code, "PENDING", "REJECTED");
            await notifications.ForEmployeeAsync(quotation.CreatedBy, "QUOTATION_REJECTED", $"Báo giá {code} bị từ chối duyệt.", "/technician", code);
            return QuotationView.From(quotation);
        });
    }

    private async Task<AuthenticatedActor> DispatcherAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.DISPATCHER);
        return actor;
    }
}

public sealed class CustomerDecisionService(
    QuotationStore quotations, QuotationService quotationViews, TicketStore tickets, TicketQueryService ticketViews, StaffDirectory staff,
    CurrentActor actors, TransactionRunner transactions, AuditService audit, NotificationService notifications, TimeProvider clock)
{
    public Task<QuotationView> DecideAsync(string code, Decision? decision, string? reason)
    {
        actors.Require(Permission.QUOTE_DECIDE_ON_BEHALF, Permission.QUOTE_DECIDE_OWN);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            var quotation = await quotationViews.RequireAsync(code);
            var onBehalf = await AuthorizeAsync(actor, (await ticketViews.RequireAsync(quotation.TicketId)).CustomerId);
            return await ApplyAsync(code, decision, reason, actor, onBehalf);
        });
    }

    /// <summary>
    /// Qua cổng khách (kênh PORTAL). <paramref name="customer"/> do module portal dựng từ portal token hoặc tài khoản khách sau
    /// khi đã kiểm tra POL-03 — không bao giờ lấy từ body request.
    /// </summary>
    public Task<QuotationView> DecideAsCustomerAsync(string code, Decision? decision, string? reason, AuthenticatedActor customer) =>
        transactions.InTransactionAsync(async () =>
        {
            var ticket = await ticketViews.RequireAsync((await quotationViews.RequireAsync(code)).TicketId);
            if (customer.EmployeeId is not null || ticket.CustomerId != customer.CustomerId) throw new DomainException(ErrorCode.QUOTE_NOT_FOUND);
            return await ApplyAsync(code, decision, reason, customer, false);
        });

    private async Task<QuotationView> ApplyAsync(string code, Decision? decision, string? reason, AuthenticatedActor actor, bool onBehalf)
    {
        if (decision is null) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var quotation = await quotationViews.RequireAsync(code);
        var ticket = await ticketViews.RequireAsync(quotation.TicketId);
        var now = clock.GetUtcNow();
        var recordedBy = onBehalf ? actor.EmployeeId! : "KH:" + actor.CustomerId;
        var channel = onBehalf ? "COUNTER" : "PORTAL";
        if (decision == Decision.ACCEPT)
        {
            quotation.Accept(recordedBy, channel, DbTime.Date(now), now);
            ticket.AcceptQuotation(code, quotation.Lines.Any(line => line.Sku is not null), now, actor, onBehalf);
        }
        else
        {
            quotation.Decline(recordedBy, channel, reason, now);
            ticket.DeclineQuotation(code, now, actor, onBehalf);
        }
        await quotations.SaveAsync(quotation);
        await tickets.SaveAsync(ticket);
        var accepted = decision == Decision.ACCEPT;
        await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, accepted ? "QUOTATION_ACCEPTED" : "QUOTATION_DECLINED",
            accepted ? "Khách đồng ý báo giá" : "Khách từ chối báo giá", "QUOTATION", code, "PENDING", decision.ToString());
        await notifications.ForEmployeeAsync(ticket.Assignment!.TechnicianId, accepted ? "QUOTATION_ACCEPTED" : "QUOTATION_DECLINED",
            $"Khách đã {(accepted ? "đồng ý" : "từ chối")} báo giá {code}.", "/technician", code);
        return QuotationView.From(quotation);
    }

    private async Task<bool> AuthorizeAsync(AuthenticatedActor actor, string customerId)
    {
        if (actor.Roles.Contains(Role.CUSTOMER))
            return customerId == actor.CustomerId ? false : throw new DomainException(ErrorCode.QUOTE_NOT_FOUND);
        if (actor.Roles.Contains(Role.RECEPTIONIST))
        {
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.RECEPTIONIST);
            return true;
        }
        if (actor.Roles.Contains(Role.DISPATCHER))
        {
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.DISPATCHER);
            return true;
        }
        throw new DomainException(ErrorCode.ACCESS_DENIED);
    }
}
