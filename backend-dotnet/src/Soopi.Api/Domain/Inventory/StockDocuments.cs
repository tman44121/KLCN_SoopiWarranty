using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Domain.Inventory;

/// <param name="UnitServicePrice">Giá tính khách lúc lập phiếu xuất; null với dòng cũ chưa lưu (khi đó dùng giá hiện tại).</param>
public sealed record IssueLine(string Sku, int Quantity, decimal UnitCost, string? BinCode, DateOnly? PartWarrantyExpiresOn,
    decimal? UnitServicePrice = null);

/// <summary>Phiếu xuất kho (PhieuXuatKho + ChiTietXuatKho): chờ → đã xuất / từ chối.</summary>
public sealed class StockIssue
{
    internal StockIssue()
    {
    }

    public StockIssue(string id, string ticketId, string source, string? quotationId, string reason, string technicianId, string requestedBy,
        DateTimeOffset requestedAt, IReadOnlyList<IssueLine> lines)
    {
        Id = id;
        TicketId = ticketId;
        Source = source;
        QuotationId = quotationId;
        Reason = reason;
        TechnicianId = technicianId;
        RequestedBy = requestedBy;
        RequestedAt = requestedAt;
        Status = "PENDING";
        Lines = lines;
        TotalCost = lines.Sum(line => line.UnitCost * line.Quantity);
    }

    public string Id { get; internal set; } = "";

    public string TicketId { get; internal set; } = "";

    public string Source { get; internal set; } = "";

    public string? QuotationId { get; internal set; }

    public string Reason { get; internal set; } = "";

    public string TechnicianId { get; internal set; } = "";

    public string RequestedBy { get; internal set; } = "";

    public DateTimeOffset RequestedAt { get; internal set; }

    public string Status { get; internal set; } = "";

    public string? ProcessedBy { get; internal set; }

    public DateTimeOffset? ProcessedAt { get; internal set; }

    public string? RejectedReason { get; internal set; }

    public IReadOnlyList<IssueLine> Lines { get; internal set; } = [];

    public decimal TotalCost { get; internal set; }

    internal bool Persisted { get; set; }

    public void Issue(string employeeId, DateTimeOffset now, IReadOnlyDictionary<string, string> bins)
    {
        RequirePending();
        Lines = Lines.Select(line => line with { BinCode = bins.GetValueOrDefault(line.Sku, line.BinCode!) }).ToList();
        Status = "ISSUED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
    }

    public void Reject(string employeeId, string? reason, DateTimeOffset now)
    {
        RequirePending();
        if (JavaText.IsBlank(reason)) throw DomainException.Invalid("Vui lòng ghi lý do từ chối.");
        Status = "REJECTED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
        RejectedReason = JavaText.Trim(reason);
    }

    /// <summary>BR-35: hạn bảo hành linh kiện = ngày bàn giao + số tháng bảo hành của linh kiện.</summary>
    public void ApplyPartWarranty(DateOnly handedOverOn, IReadOnlyDictionary<string, int> warrantyMonthsBySku)
    {
        if (Status != "ISSUED") return;
        Lines = Lines.Select(line => line with { PartWarrantyExpiresOn = handedOverOn.AddMonths(warrantyMonthsBySku.GetValueOrDefault(line.Sku)) }).ToList();
    }

    private void RequirePending()
    {
        if (Status != "PENDING") throw new DomainException(ErrorCode.STOCK_ISSUE_NOT_PENDING);
    }
}

public sealed record ReceiptLine(string Sku, int Quantity, decimal? UnitCost, string? SerialBatch, string? BinCode)
{
    public static ReceiptLine Of(string? sku, int quantity, decimal? unitCost, string? serialBatch, string? binCode) =>
        new(JavaText.IsBlank(sku) ? throw new DomainException(ErrorCode.VALIDATION_FAILED) : JavaText.Trim(sku), quantity, unitCost,
            Blank(serialBatch), Blank(binCode));

    private static string? Blank(string? value) => JavaText.IsBlank(value) ? null : JavaText.Trim(value);
}

/// <summary>Phiếu nhập kho (PhieuNhapKho + ChiTietNhapKho): chờ duyệt → đã duyệt / từ chối.</summary>
public sealed class StockReceipt
{
    internal StockReceipt()
    {
    }

    public StockReceipt(string id, string? supplierId, string? batchNo, DateOnly receivedOn, string requestedBy, string? note, IReadOnlyList<ReceiptLine?> lines)
    {
        Id = id;
        SupplierId = JavaText.IsBlank(supplierId) ? throw new DomainException(ErrorCode.VALIDATION_FAILED) : JavaText.Trim(supplierId);
        BatchNo = JavaText.IsBlank(batchNo) ? null : JavaText.Trim(batchNo);
        ReceivedOn = receivedOn;
        Status = "PENDING";
        RequestedBy = requestedBy;
        Note = JavaText.IsBlank(note) ? null : JavaText.Trim(note);
        ReplaceLines(lines);
    }

    public DateTimeOffset? CreatedAt { get; internal set; }

    public string Id { get; internal set; } = "";

    public string SupplierId { get; internal set; } = "";

    public string? BatchNo { get; internal set; }

    public DateOnly ReceivedOn { get; internal set; }

    public string Status { get; internal set; } = "";

    public string RequestedBy { get; internal set; } = "";

    public string? Note { get; internal set; }

    public IReadOnlyList<ReceiptLine> Lines { get; internal set; } = [];

    public decimal TotalCost { get; internal set; }

    public string? ProcessedBy { get; internal set; }

    public DateTimeOffset? ProcessedAt { get; internal set; }

    public string? RejectedReason { get; internal set; }

    internal bool Persisted { get; set; }

    public void UpdateLines(IReadOnlyList<ReceiptLine?> value)
    {
        RequirePending();
        ReplaceLines(value);
    }

    public void Approve(string employeeId, DateTimeOffset now)
    {
        RequirePending();
        Status = "APPROVED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
    }

    public void Reject(string employeeId, string? reason, DateTimeOffset now)
    {
        RequirePending();
        if (JavaText.IsBlank(reason)) throw DomainException.Invalid("Vui lòng ghi lý do từ chối.");
        Status = "REJECTED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
        RejectedReason = JavaText.Trim(reason);
    }

    private void ReplaceLines(IReadOnlyList<ReceiptLine?>? value)
    {
        if (value is null || value.Count == 0) throw DomainException.Invalid("Phiếu nhập phải có ít nhất 1 dòng linh kiện.");
        if (value.Any(line => line is null || line.Quantity <= 0)) throw new DomainException(ErrorCode.STOCK_RECEIPT_QTY_INVALID);
        if (value.Any(line => line!.UnitCost is null or < 0)) throw new DomainException(ErrorCode.STOCK_RECEIPT_COST_INVALID);
        Lines = value.Select(line => line!).ToList();
        TotalCost = Lines.Sum(line => line.UnitCost!.Value * line.Quantity);
    }

    private void RequirePending()
    {
        if (Status != "PENDING") throw new DomainException(ErrorCode.STOCK_DOC_NOT_PENDING);
    }
}

/// <summary>Phiếu điều chuyển kệ (PhieuDieuChuyen): chờ → hoàn tất / từ chối.</summary>
public sealed class StockTransfer
{
    internal StockTransfer()
    {
    }

    public StockTransfer(string id, string? sku, int quantity, string? fromBin, string? toBin, string? reason, string requestedBy)
    {
        if (JavaText.IsBlank(sku)) throw DomainException.Invalid("Vui lòng chọn linh kiện cần điều chuyển.");
        if (quantity <= 0) throw DomainException.Invalid("Số lượng điều chuyển phải lớn hơn 0.");
        if (fromBin is null || toBin is null) throw DomainException.Invalid("Vui lòng chọn đủ kệ/ngăn nguồn và kệ/ngăn đích.");
        if (fromBin == toBin) throw DomainException.Invalid("Kệ/ngăn đích phải khác kệ/ngăn nguồn.");
        if (JavaText.IsBlank(reason)) throw DomainException.Invalid("Vui lòng ghi lý do điều chuyển.");
        Id = id;
        Sku = JavaText.Trim(sku);
        Quantity = quantity;
        FromBin = JavaText.Trim(fromBin);
        ToBin = JavaText.Trim(toBin);
        Reason = JavaText.Trim(reason);
        Status = "PENDING";
        RequestedBy = requestedBy;
    }

    public DateTimeOffset? CreatedAt { get; internal set; }

    public string Id { get; internal set; } = "";

    public string Sku { get; internal set; } = "";

    public int Quantity { get; internal set; }

    public string FromBin { get; internal set; } = "";

    public string ToBin { get; internal set; } = "";

    public string Reason { get; internal set; } = "";

    public string Status { get; internal set; } = "";

    public string RequestedBy { get; internal set; } = "";

    public string? ProcessedBy { get; internal set; }

    public DateTimeOffset? ProcessedAt { get; internal set; }

    public string? RejectedReason { get; internal set; }

    internal bool Persisted { get; set; }

    public void Approve(string employeeId, DateTimeOffset now)
    {
        RequirePending();
        Status = "COMPLETED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
    }

    public void Reject(string employeeId, string? reason, DateTimeOffset now)
    {
        RequirePending();
        if (JavaText.IsBlank(reason)) throw DomainException.Invalid("Vui lòng ghi lý do từ chối.");
        Status = "REJECTED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
        RejectedReason = JavaText.Trim(reason);
    }

    private void RequirePending()
    {
        if (Status != "PENDING") throw new DomainException(ErrorCode.STOCK_DOC_NOT_PENDING);
    }
}

/// <summary>Một dòng kiểm kê: tồn hệ thống chụp lúc lập phiếu và số đếm thực tế của một linh kiện tại một kệ/ngăn.</summary>
public sealed record StocktakeLine(string Sku, string BinCode, int SystemQty, int CountedQty, string? Note)
{
    public int Difference => CountedQty - SystemQty;
}

/// <summary>
/// Phiếu kiểm kê (PhieuKiemKe + ChiTietKiemKe): chờ duyệt → hoàn tất (đã điều chỉnh tồn) / từ chối. Điều chỉnh theo chênh
/// lệch lúc đếm nên hàng nhập/xuất xảy ra giữa lúc đếm và lúc duyệt không bị ghi đè.
/// </summary>
public sealed class Stocktake
{
    private static readonly System.Text.RegularExpressions.Regex BinPattern = new("^KHO-[A-Z]-[0-9]{2}-[0-9]{2}$");

    internal Stocktake()
    {
    }

    public Stocktake(string id, string? scope, string? note, IReadOnlyList<StocktakeLine> lines, string requestedBy)
    {
        if (lines.Count == 0) throw DomainException.Invalid("Phiếu kiểm kê phải có ít nhất 1 dòng linh kiện.");
        foreach (var line in lines)
        {
            if (!BinPattern.IsMatch(line.BinCode))
                throw DomainException.Invalid($"Kệ/ngăn \"{line.BinCode}\" của {line.Sku} không đúng dạng KHO-A-01-01.");
            if (line.CountedQty < 0) throw DomainException.Invalid($"Số đếm thực tế của {line.Sku} tại {line.BinCode} không được âm.");
            if (line.Difference != 0 && JavaText.IsBlank(line.Note))
                throw DomainException.Invalid($"Vui lòng ghi lý do chênh lệch của {line.Sku} tại {line.BinCode} (lệch {line.Difference:+#;-#}).");
        }
        var duplicate = lines.GroupBy(line => (line.Sku, line.BinCode)).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null) throw DomainException.Invalid($"Linh kiện {duplicate.Key.Sku} tại {duplicate.Key.BinCode} bị nhập trùng 2 dòng.");
        Id = id;
        Scope = JavaText.IsBlank(scope) ? "Toàn kho" : JavaText.Trim(scope!);
        Note = JavaText.IsBlank(note) ? null : JavaText.Trim(note!);
        Lines = lines.Select(line => line with { Note = JavaText.IsBlank(line.Note) ? null : JavaText.Trim(line.Note!) }).ToList();
        Status = "PENDING";
        RequestedBy = requestedBy;
    }

    public DateTimeOffset? CreatedAt { get; internal set; }

    public string Id { get; internal set; } = "";

    public string Scope { get; internal set; } = "";

    public string? Note { get; internal set; }

    public IReadOnlyList<StocktakeLine> Lines { get; internal set; } = [];

    public string Status { get; internal set; } = "";

    public string RequestedBy { get; internal set; } = "";

    public string? ProcessedBy { get; internal set; }

    public DateTimeOffset? ProcessedAt { get; internal set; }

    public string? RejectedReason { get; internal set; }

    internal bool Persisted { get; set; }

    public void Approve(string employeeId, DateTimeOffset now)
    {
        RequirePending();
        Status = "COMPLETED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
    }

    public void Reject(string employeeId, string? reason, DateTimeOffset now)
    {
        RequirePending();
        if (JavaText.IsBlank(reason)) throw DomainException.Invalid("Vui lòng ghi lý do từ chối.");
        Status = "REJECTED";
        ProcessedBy = employeeId;
        ProcessedAt = now;
        RejectedReason = JavaText.Trim(reason);
    }

    private void RequirePending()
    {
        if (Status != "PENDING") throw new DomainException(ErrorCode.STOCK_DOC_NOT_PENDING);
    }
}
