using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Inventory;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Tickets;

namespace Soopi.Api.Services.Billing;

public sealed record PaymentView(
    string Code, string TicketCode, string? QuotationCode, string Type, DateTimeOffset PaidAt, string PayerName, decimal Amount, string Method,
    string CashierId, string? Note)
{
    public static PaymentView From(Payment p) => new(p.Id, p.TicketId, p.QuotationId, p.Type, p.PaidAt, p.PayerName, p.Amount, p.Method, p.CashierId, p.Note);
}

public sealed record BillingBreakdown(
    string? QuotationCode, decimal FreeWarrantyAmount, decimal PartsFee, decimal ServiceFee, decimal Vat, decimal Discount, decimal Total,
    string PaymentStatus, PaymentView? Payment);

public sealed record BillingView(
    string TicketCode, string TicketStatus, string? QuotationCode, decimal FreeWarrantyAmount, decimal PartsFee, decimal ServiceFee, decimal Vat,
    decimal Discount, decimal Total, string PaymentStatus, PaymentView? Payment);

public sealed record CollectPaymentRequest([NotBlank] string PayerName, [Pattern("CASH|BANK_TRANSFER|E_WALLET|CARD")] string? Method, string? Note,
    [PositiveOrZero] decimal? ExpectedAmount);

public sealed record FreeWarrantyRequest(string? Note);

/// <summary>Chi phí của một phiếu (UI 19A); nơi gọi tự chịu trách nhiệm phân quyền. D-009: không giảm trừ.</summary>
public sealed class BillingCalculator(QuotationStore quotations, AppDbContext db, IssuedParts issuedParts)
{
    public async Task<BillingBreakdown> BreakdownAsync(string ticketCode)
    {
        var quotation = await quotations.FindAcceptedForTicketAsync(ticketCode);
        var payment = await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.TicketId == ticketCode);
        var partsFee = quotation?.PartsTotal ?? 0;
        var serviceFee = quotation?.LaborTotal ?? 0;
        var total = quotation?.GrandTotal ?? 0;
        var freeAmount = (await issuedParts.FindByTicketAsync(ticketCode))
            .Where(part => part.Source == "FREE_WARRANTY" && part.ServicePrice is not null)
            .Sum(part => part.ServicePrice!.Value * part.Quantity);
        return new BillingBreakdown(quotation?.Id, freeAmount, partsFee, serviceFee, total - partsFee - serviceFee, 0, total,
            payment is null ? "UNPAID" : payment.Type == "FREE_WARRANTY" ? "FREE_WARRANTY" : "PAID", payment is null ? null : PaymentView.From(payment));
    }
}

public sealed class BillingQueryService(TicketQueryService tickets, TicketStore ticketStore, AppDbContext db, BillingCalculator calculator, CurrentActor actors)
{
    public async Task<BillingView> BillingAsync(string ticketCode)
    {
        actors.Require(Permission.PAYMENT_READ);
        var ticket = await tickets.RequireAsync(ticketCode);
        var value = await calculator.BreakdownAsync(ticketCode);
        return new BillingView(ticket.Id, ticket.Status.ToString(), value.QuotationCode, value.FreeWarrantyAmount, value.PartsFee, value.ServiceFee,
            value.Vat, value.Discount, value.Total, value.PaymentStatus, value.Payment);
    }

    public async Task<List<PaymentView>> ByCustomerAsync(string customerCode)
    {
        actors.Require(Permission.CUSTOMER_READ_PAYMENTS);
        var codes = (await ticketStore.FindByCustomerAsync(customerCode)).Select(ticket => ticket.Id).ToList();
        if (codes.Count == 0) return [];
        return (await db.Payments.AsNoTracking().Where(p => codes.Contains(p.TicketId)).OrderByDescending(p => p.PaidAt).ToListAsync())
            .Select(PaymentView.From).ToList();
    }
}

public sealed class PaymentService(
    AppDbContext db, QuotationStore quotations, TicketQueryService tickets, StaffDirectory staff, CodeGenerator codes, CurrentActor actors,
    TransactionRunner transactions, AuditService audit, TimeProvider clock)
{
    private static readonly HashSet<string> ChargedMethods = ["CASH", "BANK_TRANSFER", "E_WALLET", "CARD"];
    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>BR-28..BR-31, POL-12: số tiền do server lấy từ tổng báo giá.</summary>
    public Task<PaymentView> CollectAsync(string ticketCode, CollectPaymentRequest command)
    {
        actors.Require(Permission.PAYMENT_COLLECT);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await CashierAsync();
            var method = command.Method ?? "CASH";
            if (!ChargedMethods.Contains(method) || JavaText.IsBlank(command.PayerName)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
            var ticket = await tickets.RequireAsync(ticketCode);
            var quotation = ticket.ActiveQuotationId is null ? null : await quotations.FindAsync(ticket.ActiveQuotationId);
            if (quotation is null || quotation.TicketId != ticket.Id) throw new DomainException(ErrorCode.PAYMENT_QUOTE_NOT_FOUND);
            if (quotation.CustomerDecision.Status != "ACCEPTED") throw new DomainException(ErrorCode.PAYMENT_QUOTE_NOT_ACCEPTED);
            if (ticket.Status != TicketStatus.COMPLETED) throw new DomainException(ErrorCode.PAYMENT_TICKET_NOT_COMPLETED);
            await EnsureNotPaidAsync(ticketCode);
            if (command.ExpectedAmount is { } expected && expected != quotation.GrandTotal) throw new DomainException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            var payment = new Payment(await codes.NextAsync(BusinessCodeType.Payment), ticketCode, quotation.Id, "CHARGED", clock.GetUtcNow(),
                JavaText.Trim(command.PayerName), quotation.GrandTotal, method, actor.EmployeeId!, command.Note);
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
            await AuditAsync(actor, payment, "PAYMENT_COLLECTED", "Thu tiền");
            return PaymentView.From(payment);
        });
    }

    /// <summary>D-008: ca không có báo giá được khách đồng ý ghi phiếu thu 0 đ trước khi bàn giao.</summary>
    public Task<PaymentView> ConfirmFreeWarrantyAsync(string ticketCode, string? note)
    {
        actors.Require(Permission.PAYMENT_COLLECT);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await CashierAsync();
            var ticket = await tickets.RequireAsync(ticketCode);
            if (ticket.Status != TicketStatus.COMPLETED) throw new DomainException(ErrorCode.TICKET_INVALID_STATE, TicketStatus.COMPLETED.SqlLabel());
            if (await quotations.FindAcceptedForTicketAsync(ticketCode) is not null) throw new DomainException(ErrorCode.PAYMENT_NOT_FREE);
            await EnsureNotPaidAsync(ticketCode);
            var payment = new Payment(await codes.NextAsync(BusinessCodeType.Payment), ticketCode, null, "FREE_WARRANTY", clock.GetUtcNow(),
                ticket.CustomerSnapshot.GetValueOrDefault("fullName", "Khách hàng"), 0, "NONE", actor.EmployeeId!, note);
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
            await AuditAsync(actor, payment, "PAYMENT_FREE_WARRANTY", "Xác nhận miễn phí bảo hành");
            return PaymentView.From(payment);
        });
    }

    private async Task EnsureNotPaidAsync(string ticketCode)
    {
        if (await db.Payments.AnyAsync(p => p.TicketId == ticketCode)) throw new DomainException(ErrorCode.PAYMENT_ALREADY_EXISTS);
    }

    private async Task<AuthenticatedActor> CashierAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.CASHIER);
        return actor;
    }

    private Task AuditAsync(AuthenticatedActor actor, Payment payment, string action, string label) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "TICKET", payment.TicketId,
            payment.TicketId + " — Chưa thu tiền", payment.Id + " — " + ((long)payment.Amount).ToString("#,##0", Vietnamese) + " đ");
}
