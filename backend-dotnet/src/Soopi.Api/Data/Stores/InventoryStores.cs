using System.Data.Common;
using Soopi.Api.Domain.Inventory;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

public sealed record Bin(string BinCode, int Qty);

public sealed record PartStock(
    string Sku, string Name, string? Unit, string? CategoryCode, string? BrandName, decimal CostPrice, decimal ServicePrice, int OnHand,
    int Reserved, int MinLevel, string PrimaryBin, IReadOnlyList<Bin> Bins, int WarrantyMonths, string? SupplierId, string? SupplierName,
    string? SupplierPhone, bool Active)
{
    public int Available => OnHand - Reserved;
}

/// <summary>
/// Tồn kho 3 lớp: LinhKien.SoLuongTon (thực tế), SoLuongDaGiu (đã giữ), khả dụng = hiệu hai cột (tính khi đọc); tồn theo kệ ở
/// TonKhoTheoKe. Mọi thay đổi là UPDATE có điều kiện nên an toàn khi nhiều phiên cùng giữ/trừ một mã; khóa theo thứ tự
/// LinhKien → TonKhoTheoKe.
/// </summary>
public sealed class InventoryStore(Sql sql)
{
    private const string PartColumns = "lk.MaLK, lk.TenLK, lk.DonViTinh, lk.MaNhom, lk.TenHang, lk.DonGiaVon, lk.DonGiaDichVu, lk.SoLuongTon, "
        + "lk.SoLuongDaGiu, lk.DinhMucTonToiThieu, lk.KeChinh, lk.ThoiHanBaoHanhThang, lk.MaNCC, lk.HoatDong, ncc.TenNCC, ncc.SDT AS SDTNhaCungCap";

    public async Task<PartStock?> FindPartAsync(string sku) => (await PartsAsync(" WHERE lk.MaLK = ? AND lk.HoatDong = 1", "", sku)).FirstOrDefault();

    public async Task<PartStock> RequirePartAsync(string sku) => await FindPartAsync(sku) ?? throw new DomainException(ErrorCode.STOCK_ISSUE_PART_INVALID);

    public async Task<List<PartStock>> FindPartsAsync(string? query, string? category, bool lowStock)
    {
        var where = " WHERE 1 = 1";
        var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(query))
        {
            where += " AND (lk.MaLK LIKE ? OR lk.TenLK LIKE ?)";
            args.AddRange(Enumerable.Repeat<object?>(SqlLike.Contains(query.Trim()), 2));
        }
        if (!string.IsNullOrWhiteSpace(category))
        {
            where += " AND lk.MaNhom = ?";
            args.Add(category.Trim());
        }
        if (lowStock) where += " AND lk.SoLuongTon - lk.SoLuongDaGiu <= lk.DinhMucTonToiThieu";
        var parts = await PartsAsync(where, " ORDER BY lk.TenLK, lk.MaLK", [.. args]);
        return lowStock ? parts.OrderBy(part => part.Available - part.MinLevel).ToList() : parts;
    }

    public async Task<bool> SupplierExistsAsync(string? supplierId) =>
        await sql.ScalarAsync("SELECT 1 FROM NhaCungCap WHERE MaNCC = ? AND HoatDong = 1", supplierId ?? "") is not null;

    public async Task ReserveAsync(string sku, int quantity)
    {
        var updated = await sql.ExecuteAsync(
            "UPDATE LinhKien SET SoLuongDaGiu = SoLuongDaGiu + ?, PhienBan = PhienBan + 1 WHERE MaLK = ? AND HoatDong = 1 AND SoLuongTon - SoLuongDaGiu >= ?",
            quantity, sku, quantity);
        if (updated != 1) throw new DomainException(ErrorCode.STOCK_INSUFFICIENT);
    }

    public async Task ReleaseAsync(string sku, int quantity)
    {
        var updated = await sql.ExecuteAsync(
            "UPDATE LinhKien SET SoLuongDaGiu = SoLuongDaGiu - ?, PhienBan = PhienBan + 1 WHERE MaLK = ? AND SoLuongDaGiu >= ?", quantity, sku, quantity);
        if (updated != 1) throw new DomainException(ErrorCode.STOCK_INSUFFICIENT);
    }

    /// <summary>Thực xuất hàng đã giữ: trừ tồn thực tế + phần đã giữ, rồi trừ đúng kệ lấy hàng (lỗi thì cả transaction hoàn tác).</summary>
    public async Task IssueAsync(string sku, int quantity, string binCode)
    {
        var part = await sql.ExecuteAsync(
            "UPDATE LinhKien SET SoLuongTon = SoLuongTon - ?, SoLuongDaGiu = SoLuongDaGiu - ?, PhienBan = PhienBan + 1 "
            + "WHERE MaLK = ? AND SoLuongTon >= ? AND SoLuongDaGiu >= ?", quantity, quantity, sku, quantity, quantity);
        if (part != 1) throw new DomainException(ErrorCode.STOCK_INSUFFICIENT);
        var bin = await sql.ExecuteAsync(
            "UPDATE TonKhoTheoKe SET SoLuong = SoLuong - ? WHERE MaLK = ? AND MaKe = ? AND SoLuong >= ?", quantity, sku, binCode, quantity);
        if (bin != 1) throw new DomainException(ErrorCode.STOCK_BIN_INSUFFICIENT, binCode);
    }

    public async Task ReceiveAsync(string sku, int quantity, string binCode)
    {
        var part = await sql.ExecuteAsync(
            "UPDATE LinhKien SET SoLuongTon = SoLuongTon + ?, PhienBan = PhienBan + 1 WHERE MaLK = ? AND HoatDong = 1", quantity, sku);
        if (part != 1) throw new DomainException(ErrorCode.STOCK_ISSUE_PART_INVALID);
        await AddToBinAsync(sku, quantity, binCode);
    }

    public async Task TransferAsync(string sku, int quantity, string fromBin, string toBin)
    {
        var removed = await sql.ExecuteAsync(
            "UPDATE TonKhoTheoKe SET SoLuong = SoLuong - ? WHERE MaLK = ? AND MaKe = ? AND SoLuong >= ?", quantity, sku, fromBin, quantity);
        if (removed != 1) throw new DomainException(ErrorCode.STOCK_BIN_INSUFFICIENT, fromBin);
        await AddToBinAsync(sku, quantity, toBin);
    }

    /// <summary>Cộng vào ngăn kệ, tạo ngăn nếu chưa có; HOLDLOCK để hai phiếu cùng tạo một ngăn không trùng khóa.</summary>
    private Task AddToBinAsync(string sku, int quantity, string binCode) =>
        sql.ExecuteAsync(
            "MERGE TonKhoTheoKe WITH (HOLDLOCK) AS t USING (VALUES (?, ?, ?)) AS n (MaLK, MaKe, SoLuong) ON t.MaLK = n.MaLK AND t.MaKe = n.MaKe "
            + "WHEN MATCHED THEN UPDATE SET SoLuong = t.SoLuong + n.SoLuong WHEN NOT MATCHED THEN INSERT (MaLK, MaKe, SoLuong) VALUES (n.MaLK, n.MaKe, n.SoLuong);",
            sku, binCode, quantity);

    /// <summary>Linh kiện và tồn theo kệ trong một lượt tới DB (hai câu, kệ lọc bằng cùng điều kiện qua subquery).</summary>
    private async Task<List<PartStock>> PartsAsync(string where, string orderBy, params object?[] args)
    {
        var from = " FROM LinhKien lk LEFT JOIN NhaCungCap ncc ON ncc.MaNCC = lk.MaNCC" + Named(where, 0);
        var parts = new List<PartStock>();
        var bins = new List<(string Sku, Bin Bin)>();
        await sql.ReadBatchAsync(
            $"SELECT {PartColumns}{from}{orderBy}; SELECT MaLK, MaKe, SoLuong FROM TonKhoTheoKe WHERE MaLK IN (SELECT lk.MaLK{from}) ORDER BY MaLK, MaKe;",
            args,
            row => parts.Add(new PartStock(row.Str("MaLK")!, row.Str("TenLK")!, row.Str("DonViTinh"), row.Str("MaNhom"), row.Str("TenHang"),
                SqlMoney.Read(row.Dec("DonGiaVon")), SqlMoney.Read(row.Dec("DonGiaDichVu")), row.Int("SoLuongTon"), row.Int("SoLuongDaGiu"),
                row.Int("DinhMucTonToiThieu"), row.Str("KeChinh")!, [], row.Int("ThoiHanBaoHanhThang"), row.Str("MaNCC"), row.Str("TenNCC"),
                row.Str("SDTNhaCungCap"), row.Bool("HoatDong"))),
            row => bins.Add((row.Str("MaLK")!, new Bin(row.Str("MaKe")!, row.Int("SoLuong")))));
        return parts.Select(part => part with { Bins = bins.Where(item => item.Sku == part.Sku).Select(item => item.Bin).ToList() }).ToList();
    }

    /// <summary>Đổi "?" thành @p0, @p1… để dùng cùng tham số cho cả hai câu của lô.</summary>
    private static string Named(string text, int start)
    {
        var index = start;
        return string.Concat(text.Select(character => character == '?' ? "@p" + index++ : character.ToString()));
    }
}

/// <summary>
/// Chứng từ kho trên PhieuNhapKho, PhieuXuatKho, PhieuDieuChuyen. Các bảng này không có cột phiên bản nên khi đọc trong
/// transaction, dòng chứng từ được khóa (UPDLOCK, HOLDLOCK) tới lúc commit để hai người không duyệt trùng.
/// </summary>
public sealed class InventoryDocumentStore(Sql sql, TimeProvider clock)
{
    // ------------------------------------------------------------------ phiếu nhập

    public async Task SaveAsync(StockReceipt receipt)
    {
        if (!receipt.Persisted)
        {
            await sql.ExecuteAsync(
                "INSERT INTO PhieuNhapKho (MaPhieuNhap, NgayLap, MaNguoiLap, MaNCC, SoLo, NgayNhap, TrangThai, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, "
                + "TongTienNhap, GhiChu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [receipt.Id, clock.GetUtcNow(), receipt.RequestedBy, .. ReceiptHeader(receipt)]);
            receipt.Persisted = true;
        }
        else
        {
            await sql.ExecuteAsync(
                "UPDATE PhieuNhapKho SET MaNCC = ?, SoLo = ?, NgayNhap = ?, TrangThai = ?, MaNguoiDuyet = ?, NgayDuyet = ?, LyDoTuChoi = ?, "
                + "TongTienNhap = ?, GhiChu = ? WHERE MaPhieuNhap = ?",
                [.. ReceiptHeader(receipt), receipt.Id]);
        }
        var stored = await ReceiptLinesAsync([receipt.Id]);
        if (!stored.Select(item => item.Line).SequenceEqual(receipt.Lines))
        {
            await sql.ExecuteAsync("DELETE FROM ChiTietNhapKho WHERE MaPhieuNhap = ?", receipt.Id);
            foreach (var line in receipt.Lines)
                await sql.ExecuteAsync("INSERT INTO ChiTietNhapKho (MaPhieuNhap, MaLK, SoLuongNhap, DonGiaNhap, SerialLo, MaKe) VALUES (?, ?, ?, ?, ?, ?)",
                    receipt.Id, line.Sku, line.Quantity, line.UnitCost, line.SerialBatch, line.BinCode);
        }
    }

    public async Task<StockReceipt?> FindReceiptAsync(string code) =>
        (await ReceiptsAsync($"SELECT * FROM PhieuNhapKho{sql.LockHint} WHERE MaPhieuNhap = ?", code)).FirstOrDefault();

    public Task<List<StockReceipt>> FindReceiptsAsync(string? status) =>
        string.IsNullOrWhiteSpace(status)
            ? ReceiptsAsync("SELECT * FROM PhieuNhapKho ORDER BY NgayNhap DESC, MaPhieuNhap DESC")
            : ReceiptsAsync("SELECT * FROM PhieuNhapKho WHERE TrangThai = ? ORDER BY NgayNhap DESC, MaPhieuNhap DESC", status);

    private static object?[] ReceiptHeader(StockReceipt r) =>
        [r.SupplierId, r.BatchNo, r.ReceivedOn, r.Status, r.ProcessedBy, r.ProcessedAt, r.RejectedReason, r.TotalCost, r.Note];

    private async Task<List<StockReceipt>> ReceiptsAsync(string query, params object?[] args)
    {
        var receipts = await sql.QueryAsync(query, row => new StockReceipt
        {
            Id = row.Str("MaPhieuNhap")!,
            SupplierId = row.Str("MaNCC")!,
            BatchNo = row.Str("SoLo"),
            ReceivedOn = row.Date("NgayNhap")!.Value,
            Status = row.Str("TrangThai")!,
            RequestedBy = row.Str("MaNguoiLap")!,
            Note = row.Str("GhiChu"),
            TotalCost = SqlMoney.Read(row.Dec("TongTienNhap")),
            ProcessedBy = row.Str("MaNguoiDuyet"),
            ProcessedAt = row.Time("NgayDuyet"),
            RejectedReason = row.Str("LyDoTuChoi"),
            Persisted = true,
        }, args);
        if (receipts.Count == 0) return receipts;
        var lines = await ReceiptLinesAsync(receipts.Select(r => r.Id).ToList());
        receipts.ForEach(receipt => receipt.Lines = lines.Where(item => item.Receipt == receipt.Id).Select(item => item.Line).ToList());
        return receipts;
    }

    private Task<List<(string Receipt, ReceiptLine Line)>> ReceiptLinesAsync(List<string> codes) =>
        sql.QueryAsync(
            $"SELECT * FROM ChiTietNhapKho WHERE MaPhieuNhap IN ({string.Join(", ", codes.Select(_ => "?"))}) ORDER BY MaChiTietNhap",
            row => (row.Str("MaPhieuNhap")!, new ReceiptLine(row.Str("MaLK")!, row.Int("SoLuongNhap"), SqlMoney.Read(row.Dec("DonGiaNhap")),
                row.Str("SerialLo"), row.Str("MaKe"))),
            codes.Cast<object?>().ToArray());

    // ------------------------------------------------------------------ phiếu xuất

    public async Task SaveAsync(StockIssue issue)
    {
        object?[] header =
        [
            issue.TicketId, issue.Source, issue.QuotationId, issue.Reason, issue.TechnicianId, issue.RequestedBy, issue.RequestedAt, issue.Status,
            issue.ProcessedBy, issue.ProcessedAt, issue.RejectedReason, issue.TotalCost,
        ];
        if (!issue.Persisted)
        {
            await sql.ExecuteAsync(
                "INSERT INTO PhieuXuatKho (MaPhieuTN, NguonXuat, MaBaoGia, LyDoXuat, MaKTVNhan, MaNguoiYeuCau, NgayYeuCau, TrangThai, MaThuKhoXuLy, "
                + "NgayXuLy, LyDoTuChoi, TongTienXuat, MaPhieuXuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [.. header, issue.Id]);
            issue.Persisted = true;
        }
        else
        {
            await sql.ExecuteAsync(
                "UPDATE PhieuXuatKho SET MaPhieuTN = ?, NguonXuat = ?, MaBaoGia = ?, LyDoXuat = ?, MaKTVNhan = ?, MaNguoiYeuCau = ?, NgayYeuCau = ?, "
                + "TrangThai = ?, MaThuKhoXuLy = ?, NgayXuLy = ?, LyDoTuChoi = ?, TongTienXuat = ? WHERE MaPhieuXuat = ?",
                [.. header, issue.Id]);
        }
        var stored = (await sql.QueryAsync("SELECT MaLK FROM ChiTietXuatKho WHERE MaPhieuXuat = ?", row => row.Str("MaLK")!, issue.Id)).ToHashSet();
        foreach (var line in issue.Lines)
        {
            if (!stored.Contains(line.Sku))
                await sql.ExecuteAsync("INSERT INTO ChiTietXuatKho (MaPhieuXuat, MaLK, SoLuongXuat, DonGiaXuat) VALUES (?, ?, ?, ?)",
                    issue.Id, line.Sku, line.Quantity, line.UnitCost);
            await sql.ExecuteAsync(
                "UPDATE ChiTietXuatKho SET MaKe = ?, NgayHetHanBaoHanhLK = COALESCE(?, NgayHetHanBaoHanhLK) WHERE MaPhieuXuat = ? AND MaLK = ?",
                line.BinCode, line.PartWarrantyExpiresOn, issue.Id, line.Sku);
        }
    }

    public async Task<StockIssue?> FindIssueAsync(string code) =>
        (await IssuesAsync($"SELECT * FROM PhieuXuatKho{sql.LockHint} WHERE MaPhieuXuat = ?", code)).FirstOrDefault();

    public Task<List<StockIssue>> FindIssuesAsync(string? status, string? technicianId) =>
        IssuesAsync("SELECT * FROM PhieuXuatKho WHERE (? IS NULL OR TrangThai = ?) AND (? IS NULL OR MaKTVNhan = ?) ORDER BY NgayYeuCau, MaPhieuXuat",
            string.IsNullOrWhiteSpace(status) ? null : status, string.IsNullOrWhiteSpace(status) ? null : status, technicianId, technicianId);

    public async Task<bool> HasPendingIssueAsync(string ticketCode) =>
        await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuXuatKho WHERE MaPhieuTN = ? AND TrangThai = 'PENDING'", ticketCode) is not null;

    public Task<List<StockIssue>> FindIssuedByTicketAsync(string ticketCode) =>
        IssuesAsync("SELECT * FROM PhieuXuatKho WHERE MaPhieuTN = ? AND TrangThai = 'ISSUED' ORDER BY NgayYeuCau, MaPhieuXuat", ticketCode);

    private async Task<List<StockIssue>> IssuesAsync(string query, params object?[] args)
    {
        var issues = await sql.QueryAsync(query, row => new StockIssue
        {
            Id = row.Str("MaPhieuXuat")!,
            TicketId = row.Str("MaPhieuTN")!,
            Source = row.Str("NguonXuat")!,
            QuotationId = row.Str("MaBaoGia"),
            Reason = row.Str("LyDoXuat")!,
            TechnicianId = row.Str("MaKTVNhan")!,
            RequestedBy = row.Str("MaNguoiYeuCau")!,
            RequestedAt = row.Time("NgayYeuCau")!.Value,
            Status = row.Str("TrangThai")!,
            ProcessedBy = row.Str("MaThuKhoXuLy"),
            ProcessedAt = row.Time("NgayXuLy"),
            RejectedReason = row.Str("LyDoTuChoi"),
            TotalCost = SqlMoney.Read(row.Dec("TongTienXuat")),
            Persisted = true,
        }, args);
        if (issues.Count == 0) return issues;
        var codes = issues.Select(issue => issue.Id).ToList();
        var lines = await sql.QueryAsync(
            $"SELECT * FROM ChiTietXuatKho WHERE MaPhieuXuat IN ({string.Join(", ", codes.Select(_ => "?"))}) ORDER BY MaChiTietXuat",
            row => (Issue: row.Str("MaPhieuXuat")!, Line: new IssueLine(row.Str("MaLK")!, row.Int("SoLuongXuat"), SqlMoney.Read(row.Dec("DonGiaXuat")),
                row.Str("MaKe"), row.Date("NgayHetHanBaoHanhLK"))),
            codes.Cast<object?>().ToArray());
        issues.ForEach(issue => issue.Lines = lines.Where(item => item.Issue == issue.Id).Select(item => item.Line).ToList());
        return issues;
    }

    // ------------------------------------------------------------------ điều chuyển

    public async Task SaveAsync(StockTransfer transfer)
    {
        object?[] values =
        [
            transfer.Sku, transfer.Quantity, transfer.FromBin, transfer.ToBin, transfer.Reason, transfer.Status, transfer.RequestedBy,
            transfer.ProcessedBy, transfer.ProcessedAt, transfer.RejectedReason,
        ];
        if (!transfer.Persisted)
        {
            await sql.ExecuteAsync(
                "INSERT INTO PhieuDieuChuyen (MaLK, SoLuong, TuKe, DenKe, LyDo, TrangThai, MaNguoiLap, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, MaPhieuDC, NgayLap) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [.. values, transfer.Id, clock.GetUtcNow()]);
            transfer.Persisted = true;
            return;
        }
        await sql.ExecuteAsync(
            "UPDATE PhieuDieuChuyen SET MaLK = ?, SoLuong = ?, TuKe = ?, DenKe = ?, LyDo = ?, TrangThai = ?, MaNguoiLap = ?, MaNguoiDuyet = ?, "
            + "NgayDuyet = ?, LyDoTuChoi = ? WHERE MaPhieuDC = ?",
            [.. values, transfer.Id]);
    }

    public async Task<StockTransfer?> FindTransferAsync(string code) =>
        (await TransfersAsync($"SELECT * FROM PhieuDieuChuyen{sql.LockHint} WHERE MaPhieuDC = ?", code)).FirstOrDefault();

    public Task<List<StockTransfer>> FindTransfersAsync(string? status) =>
        string.IsNullOrWhiteSpace(status)
            ? TransfersAsync("SELECT * FROM PhieuDieuChuyen ORDER BY MaPhieuDC DESC")
            : TransfersAsync("SELECT * FROM PhieuDieuChuyen WHERE TrangThai = ? ORDER BY MaPhieuDC DESC", status);

    private Task<List<StockTransfer>> TransfersAsync(string query, params object?[] args) =>
        sql.QueryAsync(query, row => new StockTransfer
        {
            Id = row.Str("MaPhieuDC")!,
            Sku = row.Str("MaLK")!,
            Quantity = row.Int("SoLuong"),
            FromBin = row.Str("TuKe")!,
            ToBin = row.Str("DenKe")!,
            Reason = row.Str("LyDo")!,
            Status = row.Str("TrangThai")!,
            RequestedBy = row.Str("MaNguoiLap")!,
            ProcessedBy = row.Str("MaNguoiDuyet"),
            ProcessedAt = row.Time("NgayDuyet"),
            RejectedReason = row.Str("LyDoTuChoi"),
            Persisted = true,
        }, args);
}
