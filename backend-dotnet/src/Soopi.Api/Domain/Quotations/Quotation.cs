using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Domain.Quotations;

public sealed record QuotationLine(int LineNo, string? Sku, string? Description, int Quantity, decimal? UnitPrice, decimal? LaborFee)
{
    /// <summary>Thành tiền = SL × ĐG + công (đã làm tròn tới đồng, khớp CHECK CK_CTBG_ThanhTien).</summary>
    public decimal? LineTotal => UnitPrice is null || LaborFee is null ? null : Money.Round(UnitPrice.Value * Quantity + LaborFee.Value);

    public static QuotationLine Of(int lineNo, string? sku, string? description, int quantity, decimal? unitPrice, decimal? laborFee) =>
        new(lineNo, BlankToNull(sku), BlankToNull(description), quantity,
            unitPrice is null ? null : Money.Round(unitPrice.Value), laborFee is null ? null : Money.Round(laborFee.Value));

    private static string? BlankToNull(string? value) => JavaText.IsBlank(value) ? null : JavaText.Trim(value);
}

public sealed record Approval(string Status, string? ReviewedBy, DateTimeOffset? ReviewedAt, string? Note);

public sealed record CustomerDecision(string Status, DateTimeOffset? DecidedAt, string? Reason, string? Channel, string? RecordedBy);

public enum Decision
{
    ACCEPT,
    DECLINE,
}

/// <summary>Báo giá (PhieuBaoGia + ChiTietBaoGia): tổng, VAT làm tròn HALF_UP; duyệt nội bộ rồi khách quyết định.</summary>
public sealed class Quotation
{
    internal Quotation()
    {
    }

    public Quotation(string id, string ticketId, string? inspectionCode, string createdBy, DateTimeOffset createdAt, DateOnly createdDate,
        DateOnly? validUntil, decimal? vatRate, string? serviceFeeCode, IReadOnlyList<QuotationLine?> lines)
    {
        if (validUntil is { } until && until < createdDate) throw new DomainException(ErrorCode.QUOTE_VALID_UNTIL_BEFORE_CREATED);
        Id = id;
        TicketId = ticketId;
        InspectionCode = inspectionCode;
        CreatedBy = createdBy;
        CreatedAt = createdAt;
        ValidUntil = validUntil;
        VatRate = vatRate ?? 8.00m;
        if (VatRate < 0 || VatRate > 100) throw new DomainException(ErrorCode.QUOTE_LINE_INVALID);
        ServiceFeeCode = JavaText.IsBlank(serviceFeeCode) ? null : JavaText.Trim(serviceFeeCode);
        Approval = new Approval("PENDING", null, null, null);
        CustomerDecision = new CustomerDecision("PENDING", null, null, null, null);
        ReplaceLines(lines);
    }

    public string Id { get; internal set; } = "";

    public string TicketId { get; internal set; } = "";

    public string? InspectionCode { get; internal set; }

    public string CreatedBy { get; internal set; } = "";

    public DateTimeOffset CreatedAt { get; internal set; }

    public DateOnly? ValidUntil { get; internal set; }

    public decimal VatRate { get; internal set; }

    public string? ServiceFeeCode { get; internal set; }

    public IReadOnlyList<QuotationLine> Lines { get; internal set; } = [];

    public decimal PartsTotal { get; internal set; }

    public decimal LaborTotal { get; internal set; }

    public decimal GrandTotal { get; internal set; }

    public Approval Approval { get; internal set; } = null!;

    public CustomerDecision CustomerDecision { get; internal set; } = null!;

    public bool Active => Approval.Status != "REJECTED";

    /// <summary>Có báo giá đã lưu (để tầng lưu trữ biết thêm mới hay cập nhật).</summary>
    internal bool Persisted { get; set; }

    public void UpdateLines(IReadOnlyList<QuotationLine?> value)
    {
        if (Approval.Status != "PENDING") throw new DomainException(ErrorCode.QUOTE_LOCKED);
        ReplaceLines(value);
    }

    public void Approve(string reviewerId, string? note, DateTimeOffset now)
    {
        RequirePendingReview();
        if (CreatedBy == reviewerId) throw new DomainException(ErrorCode.QUOTE_SELF_REVIEW);
        Approval = new Approval("APPROVED", reviewerId, now, BlankToNull(note));
    }

    public void Reject(string reviewerId, string? note, DateTimeOffset now)
    {
        RequirePendingReview();
        if (JavaText.IsBlank(note)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        if (CreatedBy == reviewerId) throw new DomainException(ErrorCode.QUOTE_SELF_REVIEW);
        Approval = new Approval("REJECTED", reviewerId, now, JavaText.Trim(note));
    }

    public void Accept(string recordedBy, string channel, DateOnly today, DateTimeOffset now)
    {
        RequirePendingDecision();
        if (ValidUntil is { } until && today > until) throw new DomainException(ErrorCode.QUOTE_EXPIRED);
        CustomerDecision = new CustomerDecision("ACCEPTED", now, null, channel, recordedBy);
    }

    public void Decline(string recordedBy, string channel, string? reason, DateTimeOffset now)
    {
        RequirePendingDecision();
        if (JavaText.IsBlank(reason)) throw new DomainException(ErrorCode.QUOTE_DECLINE_REASON_REQUIRED);
        CustomerDecision = new CustomerDecision("DECLINED", now, JavaText.Trim(reason), channel, recordedBy);
    }

    private void ReplaceLines(IReadOnlyList<QuotationLine?>? value)
    {
        if (value is null || value.Count == 0) throw new DomainException(ErrorCode.QUOTE_LINES_REQUIRED);
        if (value.Any(line => line is null || JavaText.IsBlank(line.Description) || line.Quantity <= 0 || line.UnitPrice is null or < 0
                || line.LaborFee is null or < 0))
            throw new DomainException(ErrorCode.QUOTE_LINE_INVALID);
        Lines = value.Select(line => line!).ToList();
        PartsTotal = Money.Round(Lines.Sum(line => line.UnitPrice!.Value * line.Quantity));
        LaborTotal = Money.Round(Lines.Sum(line => line.LaborFee!.Value));
        GrandTotal = Money.Round((PartsTotal + LaborTotal) * (1 + Math.Round(VatRate / 100, 8, MidpointRounding.AwayFromZero)));
    }

    private void RequirePendingReview()
    {
        if (Approval.Status != "PENDING") throw new DomainException(ErrorCode.QUOTE_ALREADY_REVIEWED);
        if (Lines.Count == 0) throw new DomainException(ErrorCode.QUOTE_LINES_REQUIRED);
    }

    private void RequirePendingDecision()
    {
        if (Approval.Status != "APPROVED") throw new DomainException(ErrorCode.QUOTE_NOT_APPROVED);
        if (CustomerDecision.Status != "PENDING") throw new DomainException(ErrorCode.QUOTE_ALREADY_DECIDED);
    }

    private static string? BlankToNull(string? value) => JavaText.IsBlank(value) ? null : JavaText.Trim(value);
}
