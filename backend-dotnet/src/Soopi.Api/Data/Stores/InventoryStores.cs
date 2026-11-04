using System.Data.Common;
using Soopi.Api.Domain.Inventory;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

public sealed record Bin(string BinCode, int Qty);

/// <summary>Một lần tồn của linh kiện thay đổi theo chứng từ đã duyệt (điều chuyển ra 2 dòng: rời kệ cũ, vào kệ mới).</summary>
public sealed record StockMovement(DateTimeOffset At, string Kind, string DocumentCode, string BinCode, int Quantity, string? Reference, string? Note, string? ActorId);

public sealed record StocktakeSheetRow(string Sku, string Name, string? Unit, string? CategoryCode, string BinCode, int SystemQty);

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

    /// <summary>Danh sách cần đếm: mỗi linh kiện đang dùng × kệ đang có hàng (chưa có kệ nào thì kệ chính, tồn 0).</summary>
    public Task<List<StocktakeSheetRow>> StocktakeSheetAsync(string? category, string? binPrefix)
    {
        var where = " WHERE lk.HoatDong = 1";
        var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(category)) { where += " AND lk.MaNhom = ?"; args.Add(category.Trim()); }
        if (!string.IsNullOrWhiteSpace(binPrefix)) { where += " AND ISNULL(t.MaKe, lk.KeChinh) LIKE ?"; args.Add(SqlLike.StartsWith(binPrefix.Trim().ToUpperInvariant())); }
        return sql.QueryAsync(
            "SELECT lk.MaLK, lk.TenLK, lk.DonViTinh, lk.MaNhom, ISNULL(t.MaKe, lk.KeChinh) AS MaKe, ISNULL(t.SoLuong, 0) AS SoLuong "
            + "FROM LinhKien lk LEFT JOIN TonKhoTheoKe t ON t.MaLK = lk.MaLK" + where + " ORDER BY ISNULL(t.MaKe, lk.KeChinh), lk.MaLK",
            row => new StocktakeSheetRow(row.Str("MaLK")!, row.Str("TenLK")!, row.Str("DonViTinh"), row.Str("MaNhom"), row.Str("MaKe")!, row.Int("SoLuong")),
            [.. args]);
    }

    /// <summary>
    /// Thẻ kho: mọi biến động đã duyệt của một linh kiện — nhập (NgayDuyet), xuất cho phiếu sửa chữa (NgayXuLy), điều chuyển
    /// và điều chỉnh kiểm kê — mới nhất trước. Phiếu chờ duyệt / từ chối chưa làm đổi tồn nên không có ở đây.
    /// </summary>
    public Task<List<StockMovement>> MovementsAsync(string sku, int limit) =>
        sql.QueryAsync($"""
            SELECT TOP ({limit}) * FROM (
                SELECT p.NgayDuyet AS ThoiGian, 'RECEIPT' AS Loai, p.MaPhieuNhap AS MaChungTu, ISNULL(c.MaKe, lk.KeChinh) AS MaKe, c.SoLuongNhap AS SoLuong,
                       ncc.TenNCC AS ThamChieu, p.SoLo AS GhiChu, p.MaNguoiDuyet AS NguoiThucHien
                FROM ChiTietNhapKho c JOIN PhieuNhapKho p ON p.MaPhieuNhap = c.MaPhieuNhap JOIN LinhKien lk ON lk.MaLK = c.MaLK
                LEFT JOIN NhaCungCap ncc ON ncc.MaNCC = p.MaNCC
                WHERE c.MaLK = ? AND p.TrangThai = 'APPROVED'
                UNION ALL
                SELECT p.NgayXuLy, 'ISSUE', p.MaPhieuXuat, ISNULL(c.MaKe, lk.KeChinh), -c.SoLuongXuat, p.MaPhieuTN, p.LyDoXuat, p.MaThuKhoXuLy
                FROM ChiTietXuatKho c JOIN PhieuXuatKho p ON p.MaPhieuXuat = c.MaPhieuXuat JOIN LinhKien lk ON lk.MaLK = c.MaLK
                WHERE c.MaLK = ? AND p.TrangThai = 'ISSUED'
                UNION ALL
                SELECT NgayDuyet, 'TRANSFER_OUT', MaPhieuDC, TuKe, -SoLuong, DenKe, LyDo, MaNguoiDuyet
                FROM PhieuDieuChuyen WHERE MaLK = ? AND TrangThai = 'COMPLETED'
                UNION ALL
                SELECT NgayDuyet, 'TRANSFER_IN', MaPhieuDC, DenKe, SoLuong, TuKe, LyDo, MaNguoiDuyet
                FROM PhieuDieuChuyen WHERE MaLK = ? AND TrangThai = 'COMPLETED'
                UNION ALL
                SELECT p.NgayDuyet, 'STOCKTAKE', p.MaPhieuKK, c.MaKe, c.SoLuongThucTe - c.SoLuongHeThong, p.PhamVi, c.GhiChu, p.MaNguoiDuyet
                FROM ChiTietKiemKe c JOIN PhieuKiemKe p ON p.MaPhieuKK = c.MaPhieuKK
                WHERE c.MaLK = ? AND p.TrangThai = 'COMPLETED' AND c.SoLuongThucTe <> c.SoLuongHeThong
            ) m ORDER BY ThoiGian DESC, MaChungTu DESC, Loai DESC
            """,
            row => new StockMovement(row.Time("ThoiGian")!.Value, row.Str("Loai")!, row.Str("MaChungTu")!, row.Str("MaKe")!, row.Int("SoLuong"),
                row.Str("ThamChieu"), row.Str("GhiChu"), row.Str("NguoiThucHien")),
            sku, sku, sku, sku, sku);

    /// <summary>Tồn hiện tại của một linh kiện tại một kệ (chưa có dòng kệ = 0).</summary>
    public async Task<int> BinQuantityAsync(string sku, string binCode) =>
        Convert.ToInt32(await sql.ScalarAsync("SELECT SoLuong FROM TonKhoTheoKe WHERE MaLK = ? AND MaKe = ?", sku, binCode) ?? 0);

    /// <summary>
    /// Điều chỉnh sau kiểm kê: cộng/trừ <paramref name="delta"/> vào tồn thực tế và kệ. Không cho tồn thực tế xuống dưới phần
    /// đã giữ cho phiếu sửa chữa, cũng không cho kệ âm.
    /// </summary>
    public async Task AdjustAsync(string sku, string binCode, int delta)
    {
        if (delta == 0) return;
        if (delta > 0)
        {
            var added = await sql.ExecuteAsync("UPDATE LinhKien SET SoLuongTon = SoLuongTon + ?, PhienBan = PhienBan + 1 WHERE MaLK = ?", delta, sku);
            if (added != 1) throw new DomainException(ErrorCode.STOCK_ISSUE_PART_INVALID);
            await AddToBinAsync(sku, delta, binCode);
            return;
        }
        var part = await sql.FirstOrDefaultAsync("SELECT SoLuongTon, SoLuongDaGiu FROM LinhKien WITH (UPDLOCK) WHERE MaLK = ?",
            row => (OnHand: row.Int("SoLuongTon"), Reserved: row.Int("SoLuongDaGiu")), sku);
        if (part.OnHand + delta < part.Reserved)
            throw new DomainException(ErrorCode.STOCKTAKE_BELOW_RESERVED, sku, part.OnHand + delta, part.Reserved);
        await sql.ExecuteAsync("UPDATE LinhKien SET SoLuongTon = SoLuongTon + ?, PhienBan = PhienBan + 1 WHERE MaLK = ?", delta, sku);
        var bin = await sql.ExecuteAsync(
            "UPDATE TonKhoTheoKe SET SoLuong = SoLuong + ? WHERE MaLK = ? AND MaKe = ? AND SoLuong + ? >= 0", delta, sku, binCode, delta);
        if (bin != 1) throw new DomainException(ErrorCode.STOCK_BIN_INSUFFICIENT, binCode);
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
        var binsBySku = bins.ToLookup(item => item.Sku, item => item.Bin);
        return parts.Select(part => part with { Bins = binsBySku[part.Sku].ToList() }).ToList();
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
    public async Task<long> CountDocumentsAsync(InventoryDocumentKind kind, InventoryDocumentFilter filter)
    {
        var (query, args) = DocumentQuery(kind, filter, true);
        return Convert.ToInt64(await sql.ScalarAsync(query, args));
    }

    public Task<List<StockReceipt>> SearchReceiptsAsync(InventoryDocumentFilter filter)
    {
        var (query, args) = DocumentQuery(InventoryDocumentKind.Receipt, filter, false);
        return ReceiptsAsync(query, args);
    }

    public Task<List<StockIssue>> SearchIssuesAsync(InventoryDocumentFilter filter)
    {
        var (query, args) = DocumentQuery(InventoryDocumentKind.Issue, filter, false);
        return IssuesAsync(query, args);
    }

    public Task<List<Stocktake>> SearchStocktakesAsync(InventoryDocumentFilter filter)
    {
        var (query, args) = DocumentQuery(InventoryDocumentKind.Stocktake, filter, false);
        return StocktakesAsync(query, args);
    }

    public Task<List<StockTransfer>> SearchTransfersAsync(InventoryDocumentFilter filter)
    {
        var (query, args) = DocumentQuery(InventoryDocumentKind.Transfer, filter, false);
        return TransfersAsync(query, args);
    }

    private static (string Query, object?[] Args) DocumentQuery(InventoryDocumentKind kind, InventoryDocumentFilter filter, bool count)
    {
        filter.Validate(kind);
        var (table, key, date, search) = kind switch
        {
            InventoryDocumentKind.Receipt => ("PhieuNhapKho", "MaPhieuNhap", "NgayLap",
                "d.MaPhieuNhap LIKE ? OR d.SoLo LIKE ? OR EXISTS(SELECT 1 FROM NhaCungCap n WHERE n.MaNCC=d.MaNCC AND n.TenNCC LIKE ?) "
                + "OR EXISTS(SELECT 1 FROM ChiTietNhapKho c JOIN LinhKien l ON l.MaLK=c.MaLK WHERE c.MaPhieuNhap=d.MaPhieuNhap AND (c.MaLK LIKE ? OR l.TenLK LIKE ?))"),
            InventoryDocumentKind.Issue => ("PhieuXuatKho", "MaPhieuXuat", "NgayYeuCau",
                "d.MaPhieuXuat LIKE ? OR d.MaPhieuTN LIKE ? OR d.MaBaoGia LIKE ? OR d.MaKTVNhan LIKE ? "
                + "OR EXISTS(SELECT 1 FROM NhanVien n WHERE n.MaNV=d.MaKTVNhan AND n.HoTen LIKE ?) "
                + "OR EXISTS(SELECT 1 FROM ChiTietXuatKho c JOIN LinhKien l ON l.MaLK=c.MaLK WHERE c.MaPhieuXuat=d.MaPhieuXuat AND (c.MaLK LIKE ? OR l.TenLK LIKE ?))"),
            InventoryDocumentKind.Transfer => ("PhieuDieuChuyen", "MaPhieuDC", "NgayLap",
                "d.MaPhieuDC LIKE ? OR d.MaLK LIKE ? OR d.TuKe LIKE ? OR d.DenKe LIKE ? OR d.LyDo LIKE ? "
                + "OR EXISTS(SELECT 1 FROM LinhKien l WHERE l.MaLK=d.MaLK AND l.TenLK LIKE ?)"),
            InventoryDocumentKind.Stocktake => ("PhieuKiemKe", "MaPhieuKK", "NgayLap",
                "d.MaPhieuKK LIKE ? OR d.PhamVi LIKE ? OR d.GhiChu LIKE ? "
                + "OR EXISTS(SELECT 1 FROM ChiTietKiemKe c JOIN LinhKien l ON l.MaLK=c.MaLK WHERE c.MaPhieuKK=d.MaPhieuKK AND (c.MaLK LIKE ? OR l.TenLK LIKE ? OR c.MaKe LIKE ?))"),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };
        var query = $"SELECT {(count ? "COUNT(*)" : "d.*")} FROM {table} d WHERE 1=1";
        var args = new List<object?>();
        if (!string.IsNullOrEmpty(filter.Status)) { query += " AND d.TrangThai=?"; args.Add(filter.Status); }
        if (filter.From is not null) { query += $" AND d.{date}>=?"; args.Add(filter.From); }
        if (filter.To is not null) { query += $" AND d.{date}<=?"; args.Add(filter.To); }
        if (!string.IsNullOrWhiteSpace(filter.Query))
        {
            query += $" AND ({search})";
            args.AddRange(Enumerable.Repeat<object?>(SqlLike.Contains(filter.Query.Trim()), search.Count(c => c == '?')));
        }
        if (!count)
        {
            var direction = filter.Sort == "oldest" ? "ASC" : "DESC";
            query += $" ORDER BY d.{date} {direction},d.{key} {direction} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
            args.Add((long)filter.Page * filter.Size); args.Add(filter.Size);
        }
        return (query, [.. args]);
    }

    // ------------------------------------------------------------------ phiếu nhập

    public async Task SaveAsync(StockReceipt receipt)
    {
        if (!receipt.Persisted)
        {
            receipt.CreatedAt = clock.GetUtcNow();
            await sql.ExecuteAsync(
                "INSERT INTO PhieuNhapKho (MaPhieuNhap, NgayLap, MaNguoiLap, MaNCC, SoLo, NgayNhap, TrangThai, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, "
                + "TongTienNhap, GhiChu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [receipt.Id, receipt.CreatedAt, receipt.RequestedBy, .. ReceiptHeader(receipt)]);
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
            CreatedAt = row.Time("NgayLap"),
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
            transfer.CreatedAt = clock.GetUtcNow();
            await sql.ExecuteAsync(
                "INSERT INTO PhieuDieuChuyen (MaLK, SoLuong, TuKe, DenKe, LyDo, TrangThai, MaNguoiLap, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, MaPhieuDC, NgayLap) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [.. values, transfer.Id, transfer.CreatedAt]);
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
            CreatedAt = row.Time("NgayLap"),
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

    // ------------------------------------------------------------------ kiểm kê

    public async Task SaveAsync(Stocktake stocktake)
    {
        object?[] values = [stocktake.Scope, stocktake.Note, stocktake.Status, stocktake.RequestedBy, stocktake.ProcessedBy, stocktake.ProcessedAt, stocktake.RejectedReason];
        if (stocktake.Persisted)
        {
            await sql.ExecuteAsync(
                "UPDATE PhieuKiemKe SET PhamVi = ?, GhiChu = ?, TrangThai = ?, MaNguoiLap = ?, MaNguoiDuyet = ?, NgayDuyet = ?, LyDoTuChoi = ? WHERE MaPhieuKK = ?",
                [.. values, stocktake.Id]);
            return;
        }
        stocktake.CreatedAt = clock.GetUtcNow();
        await sql.ExecuteAsync(
            "INSERT INTO PhieuKiemKe (PhamVi, GhiChu, TrangThai, MaNguoiLap, MaNguoiDuyet, NgayDuyet, LyDoTuChoi, MaPhieuKK, NgayLap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [.. values, stocktake.Id, stocktake.CreatedAt]);
        foreach (var line in stocktake.Lines)
            await sql.ExecuteAsync(
                "INSERT INTO ChiTietKiemKe (MaPhieuKK, MaLK, MaKe, SoLuongHeThong, SoLuongThucTe, GhiChu) VALUES (?, ?, ?, ?, ?, ?)",
                stocktake.Id, line.Sku, line.BinCode, line.SystemQty, line.CountedQty, line.Note);
        stocktake.Persisted = true;
    }

    public async Task<Stocktake?> FindStocktakeAsync(string code) =>
        (await StocktakesAsync($"SELECT * FROM PhieuKiemKe{sql.LockHint} WHERE MaPhieuKK = ?", code)).FirstOrDefault();

    private async Task<List<Stocktake>> StocktakesAsync(string query, params object?[] args)
    {
        var stocktakes = await sql.QueryAsync(query, row => new Stocktake
        {
            Id = row.Str("MaPhieuKK")!,
            Scope = row.Str("PhamVi")!,
            Note = row.Str("GhiChu"),
            Status = row.Str("TrangThai")!,
            RequestedBy = row.Str("MaNguoiLap")!,
            CreatedAt = row.Time("NgayLap"),
            ProcessedBy = row.Str("MaNguoiDuyet"),
            ProcessedAt = row.Time("NgayDuyet"),
            RejectedReason = row.Str("LyDoTuChoi"),
            Persisted = true,
        }, args);
        if (stocktakes.Count == 0) return stocktakes;
        var codes = stocktakes.Select(item => item.Id).ToList();
        var lines = await sql.QueryAsync(
            $"SELECT MaPhieuKK, MaLK, MaKe, SoLuongHeThong, SoLuongThucTe, GhiChu FROM ChiTietKiemKe WHERE MaPhieuKK IN ({string.Join(", ", codes.Select(_ => "?"))}) "
            + "ORDER BY MaKe, MaLK",
            row => (Code: row.Str("MaPhieuKK")!, Line: new StocktakeLine(row.Str("MaLK")!, row.Str("MaKe")!, row.Int("SoLuongHeThong"), row.Int("SoLuongThucTe"), row.Str("GhiChu"))),
            codes.Cast<object?>().ToArray());
        stocktakes.ForEach(item => item.Lines = lines.Where(line => line.Code == item.Id).Select(line => line.Line).ToList());
        return stocktakes;
    }
}
