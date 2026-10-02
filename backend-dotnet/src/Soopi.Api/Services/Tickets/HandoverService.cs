using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Files;
using Soopi.Api.Services.Inventory;
using Soopi.Api.Services.Shared;
using Microsoft.EntityFrameworkCore;

namespace Soopi.Api.Services.Tickets;

public sealed record HandoverRequest(
    [property: NotBlank] string? ReceiverName,
    [property: NotBlank] string? ConditionOnReturn,
    bool ReturnedOldParts,
    string? NewWarrantyNote,
    [property: Min(1), Max(5)] int? Rating,
    Recheck? Recheck,
    bool CustomerConfirmed)
{
    public HandoverInput Input() => new(ReceiverName, ConditionOnReturn, ReturnedOldParts, NewWarrantyNote, Rating, Recheck, CustomerConfirmed);
}

public sealed record SlipView(
    string TicketCode, string Status, IReadOnlyDictionary<string, string> Customer, IReadOnlyDictionary<string, string> Device, Handover Handover,
    IReadOnlyList<IssuedPart> IssuedParts);

/// <summary>Bàn giao thiết bị (BR-32..BR-35, POL-09): đã thu tiền / xác nhận miễn phí, 5 mục kiểm tra, chữ ký PNG.</summary>
public sealed class HandoverService(
    TicketStore tickets, TicketQueryService views, AppDbContext db, QuotationStore quotations, IssuedParts issuedParts, FileStorage files,
    StaffDirectory staff, CodeGenerator codes, CurrentActor actors, TransactionRunner transactions, AuditService audit,
    NotificationService notifications, TimeProvider clock)
{
    private static readonly Role[] HandoverRoles = [Role.CASHIER, Role.RECEPTIONIST, Role.DISPATCHER];

    public Task<TicketView> HandOverAsync(string ticketCode, HandoverInput input, byte[]? signatureContent)
    {
        actors.Require(Permission.HANDOVER_COMPLETE);
        return transactions.InTransactionAsync(async () =>
        {
            var storedFiles = new List<string>();
            try
            {
                return await HandOverOnceAsync(ticketCode, input, signatureContent, storedFiles);
            }
            catch
            {
                foreach (var file in storedFiles) await files.DeleteAsync(file);
                throw;
            }
        });
    }

    public async Task<SlipView> SlipAsync(string ticketCode)
    {
        actors.Require(Permission.HANDOVER_COMPLETE);
        await HandoverActorAsync();
        var ticket = await views.RequireAsync(ticketCode);
        if (ticket.Handover is null) throw new DomainException(ErrorCode.NOT_FOUND);
        return new SlipView(ticket.Id, ticket.Status.ToString(), ticket.CustomerSnapshot, ticket.DeviceSnapshot, ticket.Handover,
            await issuedParts.FindByTicketAsync(ticketCode));
    }

    private async Task<TicketView> HandOverOnceAsync(string ticketCode, HandoverInput input, byte[]? signatureContent, List<string> storedFiles)
    {
        var actor = await HandoverActorAsync();
        var ticket = await views.RequireAsync(ticketCode);
        if (ticket.Status == TicketStatus.COMPLETED) await RequireSettledAsync(ticketCode);
        var before = ticket.Status;
        var now = clock.GetUtcNow();
        Func<Task<Signature>>? signature = signatureContent is null
            ? null
            : async () =>
            {
                var fileId = await StoreSignatureAsync(ticketCode, ticket.CustomerId, actor.EmployeeId, signatureContent);
                storedFiles.Add(fileId);
                return new Signature(fileId, now);
            };
        await ticket.HandOverAsync(await codes.NextAsync(BusinessCodeType.Handover), input, signature, now, actor);
        if (ticket.Status == TicketStatus.DELIVERED) await issuedParts.ApplyWarrantyAsync(ticketCode, DbTime.Date(now));
        await tickets.SaveAsync(ticket);
        var delivered = ticket.Status == TicketStatus.DELIVERED;
        await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "TICKET_HANDED_OVER", delivered ? "Bàn giao thiết bị" : "Trả máy không sửa",
            "TICKET", ticketCode, ticketCode + " — " + before.SqlLabel(), ticketCode + " — " + ticket.Status.SqlLabel());
        await notifications.ForCustomerAsync(ticket.CustomerId, "TICKET_HANDED_OVER",
            delivered
                ? $"Đã bàn giao thiết bị của phiếu {ticketCode}. Cảm ơn đã tin dùng dịch vụ."
                : $"Đã trả lại thiết bị (không sửa) của phiếu {ticketCode}.",
            ticketCode);
        return await views.ViewAsync(ticket, actor);
    }

    /// <summary>Chữ ký bàn giao là PNG ≤ 200 KB, nhận diện bằng magic bytes.</summary>
    private Task<string> StoreSignatureAsync(string ticketCode, string customerId, string? uploadedBy, byte[] content)
    {
        if (content.Length < 8 || content.Length > 200 * 1024
            || !content.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A }))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return files.StoreAsync(ticketCode + "-signature.png", "image/png", content,
            new FileOwner(AttachmentService.HandoverSignature, ticketCode, customerId, uploadedBy));
    }

    /// <summary>BR-33 + D-008: ca tính phí phải đã thu tiền; ca không có báo giá phải đã xác nhận miễn phí.</summary>
    private async Task RequireSettledAsync(string ticketCode)
    {
        var expected = await quotations.FindAcceptedForTicketAsync(ticketCode) is not null ? "CHARGED" : "FREE_WARRANTY";
        var payment = await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.TicketId == ticketCode);
        var actual = payment is null ? "NONE" : payment.Type == "FREE_WARRANTY" ? "FREE_WARRANTY" : "CHARGED";
        if (actual != expected) throw new DomainException(ErrorCode.HANDOVER_UNPAID);
    }

    /// <summary>BR-35: người bàn giao là Thu ngân, Lễ tân hoặc Điều phối đang làm việc.</summary>
    private async Task<AuthenticatedActor> HandoverActorAsync()
    {
        var actor = actors.Current;
        var role = HandoverRoles.FirstOrDefault(actor.Roles.Contains, Role.CUSTOMER);
        if (role == Role.CUSTOMER) throw new DomainException(ErrorCode.EMPLOYEE_ROLE_REQUIRED, Role.CASHIER.Label());
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, role);
        return actor;
    }
}
