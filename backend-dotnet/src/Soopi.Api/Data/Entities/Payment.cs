using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Entities;

/// <summary>Bảng HoaDon_PhieuThu: mỗi phiếu tiếp nhận thu đúng một lần (UX_HoaDon_PhieuTN).</summary>
public class Payment
{
    private Payment()
    {
    }

    public Payment(string id, string ticketId, string? quotationId, string type, DateTimeOffset paidAt, string payerName, decimal amount,
        string method, string cashierId, string? note)
    {
        Id = id;
        TicketId = ticketId;
        QuotationId = quotationId;
        Type = type;
        PaidAt = paidAt;
        PayerName = payerName;
        Amount = amount;
        Method = method;
        CashierId = cashierId;
        Note = JavaText.IsBlank(note) ? null : JavaText.Trim(note!);
    }

    public string Id { get; private set; } = "";

    public string TicketId { get; private set; } = "";

    public string? QuotationId { get; private set; }

    public string Type { get; private set; } = "";

    public DateTimeOffset PaidAt { get; private set; }

    public string PayerName { get; private set; } = "";

    public decimal Amount { get; private set; }

    public string Method { get; private set; } = "";

    public string CashierId { get; private set; } = "";

    public string? Note { get; private set; }
}
