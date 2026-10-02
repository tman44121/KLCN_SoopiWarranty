using System.Data.Common;
using Soopi.Api.Domain.Quotations;

namespace Soopi.Api.Data.Stores;

/// <summary>
/// Báo giá trên PhieuBaoGia/ChiTietBaoGia. Chi tiết chỉ được ghi lại khi báo giá còn chờ duyệt; trong transaction, dòng báo
/// giá được khóa khi đọc nên kiểm tra và ghi không bị thao tác khác chen vào. Tổng tiền do Quotation tính.
/// </summary>
public sealed class QuotationStore(Sql sql)
{
    // Cùng thứ tự với Header()/Review(): INSERT và UPDATE dựng từ một danh sách nên giá trị không thể lệch cột.
    private static readonly string[] HeaderColumns = ["HanHieuLuc", "ThueVAT", "MaDichVu", "TongTienLinhKien", "TongTienCong", "TongTienThanhToan"];

    private static readonly string[] ReviewColumns =
    [
        "TrangThaiDuyetNoiBo", "MaNVQuanLyDuyet", "NgayDuyetNoiBo", "GhiChuDuyet", "KhachXacNhan", "NgayKhachXacNhan",
        "LyDoKhachTuChoi", "KenhXacNhan", "NguoiGhiNhanXacNhan",
    ];

    private static readonly string[] InsertColumns =
        ["MaBaoGia", "MaPhieuTN", "MaPhieuKT", "MaKTVLap", "NgayLapBaoGia", .. HeaderColumns, .. ReviewColumns];

    private static readonly string Columns = string.Join(", ", InsertColumns);

    public async Task SaveAsync(Quotation quotation)
    {
        if (!quotation.Persisted)
        {
            await sql.ExecuteAsync(
                $"INSERT INTO PhieuBaoGia ({Columns}) VALUES ({string.Join(", ", InsertColumns.Select(_ => "?"))})",
                [quotation.Id, quotation.TicketId, quotation.InspectionCode, quotation.CreatedBy, quotation.CreatedAt, .. Header(quotation), .. Review(quotation)]);
            await InsertLinesAsync(quotation);
            quotation.Persisted = true;
            return;
        }
        var approval = await sql.ScalarAsync("SELECT TrangThaiDuyetNoiBo FROM PhieuBaoGia WHERE MaBaoGia = ?", quotation.Id) as string;
        if (approval == "PENDING" && !(await LinesAsync([quotation.Id])).Select(row => row.Line).SequenceEqual(quotation.Lines))
        {
            await sql.ExecuteAsync("DELETE FROM ChiTietBaoGia WHERE MaBaoGia = ?", quotation.Id);
            await InsertLinesAsync(quotation);
        }
        await sql.ExecuteAsync(
            $"UPDATE PhieuBaoGia SET {string.Join(", ", HeaderColumns.Concat(ReviewColumns).Select(column => column + " = ?"))} WHERE MaBaoGia = ?",
            [.. Header(quotation), .. Review(quotation), quotation.Id]);
    }

    public async Task<Quotation?> FindAsync(string code) =>
        (await LoadAsync($"SELECT {Columns} FROM PhieuBaoGia{sql.LockHint} WHERE MaBaoGia = ?", code)).FirstOrDefault();

    /// <summary>Báo giá còn hiệu lực = chưa bị từ chối duyệt (tối đa một mỗi phiếu).</summary>
    public async Task<bool> HasActiveForTicketAsync(string ticketCode) =>
        await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuBaoGia WHERE MaPhieuTN = ? AND TrangThaiDuyetNoiBo <> 'REJECTED'", ticketCode) is not null;

    public async Task<Quotation?> FindAcceptedForTicketAsync(string ticketCode) =>
        (await LoadAsync($"SELECT {Columns} FROM PhieuBaoGia WHERE MaPhieuTN = ? AND TrangThaiDuyetNoiBo <> 'REJECTED' AND KhachXacNhan = 'ACCEPTED'",
            ticketCode)).FirstOrDefault();

    public Task<List<Quotation>> FindByApprovalStatusAsync(string status, int offset, int limit) =>
        LoadAsync($"SELECT {Columns} FROM PhieuBaoGia WHERE TrangThaiDuyetNoiBo = ? ORDER BY NgayLapBaoGia, MaBaoGia OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            status, offset, Math.Max(1, limit));

    public async Task<long> CountByApprovalStatusAsync(string status) =>
        Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT(*) FROM PhieuBaoGia WHERE TrangThaiDuyetNoiBo = ?", status));

    private static object?[] Header(Quotation q) =>
        [q.ValidUntil, q.VatRate, q.ServiceFeeCode, q.PartsTotal, q.LaborTotal, q.GrandTotal];

    private static object?[] Review(Quotation q) =>
    [
        q.Approval.Status, q.Approval.ReviewedBy, q.Approval.ReviewedAt, Limit(q.Approval.Note, 500), q.CustomerDecision.Status,
        q.CustomerDecision.DecidedAt, Limit(q.CustomerDecision.Reason, 255), q.CustomerDecision.Channel, Limit(q.CustomerDecision.RecordedBy, 30),
    ];

    private async Task InsertLinesAsync(Quotation quotation)
    {
        foreach (var line in quotation.Lines)
        {
            await sql.ExecuteAsync(
                "INSERT INTO ChiTietBaoGia (MaBaoGia, SoThuTu, MaLK, NoiDungMuc, SoLuong, DonGia, TienCongSuaChua, ThanhTien) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                quotation.Id, line.LineNo, line.Sku, Limit(line.Description, 255), line.Quantity, line.UnitPrice, line.LaborFee, line.LineTotal);
        }
    }

    private async Task<List<Quotation>> LoadAsync(string query, params object?[] args)
    {
        var quotations = await sql.QueryAsync(query, Map, args);
        if (quotations.Count == 0) return quotations;
        var lines = await LinesAsync(quotations.Select(q => q.Id).ToList());
        foreach (var quotation in quotations)
            quotation.Lines = lines.Where(row => row.Quotation == quotation.Id).Select(row => row.Line).ToList();
        return quotations;
    }

    private Task<List<(string Quotation, QuotationLine Line)>> LinesAsync(List<string> codes) =>
        sql.QueryAsync(
            $"SELECT MaBaoGia, SoThuTu, MaLK, NoiDungMuc, SoLuong, DonGia, TienCongSuaChua FROM ChiTietBaoGia WHERE MaBaoGia IN ({string.Join(", ", codes.Select(_ => "?"))}) "
            + "ORDER BY MaBaoGia, SoThuTu",
            row => (row.Str("MaBaoGia")!, QuotationLine.Of(row.Int("SoThuTu"), row.Str("MaLK"), row.Str("NoiDungMuc"), row.Int("SoLuong"),
                SqlMoney.Read(row.Dec("DonGia")), SqlMoney.Read(row.Dec("TienCongSuaChua")))),
            codes.Cast<object?>().ToArray());

    private static Quotation Map(DbDataReader row) => new()
    {
        Id = row.Str("MaBaoGia")!,
        TicketId = row.Str("MaPhieuTN")!,
        InspectionCode = row.Str("MaPhieuKT"),
        CreatedBy = row.Str("MaKTVLap")!,
        CreatedAt = row.Time("NgayLapBaoGia")!.Value,
        ValidUntil = row.Date("HanHieuLuc"),
        VatRate = row.Dec("ThueVAT"),
        ServiceFeeCode = row.Str("MaDichVu"),
        PartsTotal = SqlMoney.Read(row.Dec("TongTienLinhKien")),
        LaborTotal = SqlMoney.Read(row.Dec("TongTienCong")),
        GrandTotal = SqlMoney.Read(row.Dec("TongTienThanhToan")),
        Approval = new Approval(row.Str("TrangThaiDuyetNoiBo")!, row.Str("MaNVQuanLyDuyet"), row.Time("NgayDuyetNoiBo"), row.Str("GhiChuDuyet")),
        CustomerDecision = new CustomerDecision(row.Str("KhachXacNhan")!, row.Time("NgayKhachXacNhan"), row.Str("LyDoKhachTuChoi"),
            row.Str("KenhXacNhan"), row.Str("NguoiGhiNhanXacNhan")),
        Persisted = true,
    };

    private static string? Limit(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
