using System.Data.Common;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

public sealed record NewWarrantyRequest(
    string Code,
    string FullName,
    string Phone,
    string? Email,
    string? Address,
    string CategoryCode,
    string DeviceTypeCode,
    string BrandModel,
    string IdentifierType,
    string SerialOrImei,
    string Symptom,
    string PreferredStation,
    DateTimeOffset? PreferredFrom,
    DateTimeOffset? PreferredTo,
    DateTimeOffset CreatedAt,
    string? CustomerId = null);

/// <summary>
/// Yêu cầu bảo hành trực tuyến (bảng YeuCauBaoHanh, tệp ở TepDinhKem). API trả bản ghi dạng map cùng hình dạng giao diện
/// đang dùng (<c>_id</c>, <c>customer.fullName</c>, <c>attachments</c>...).
/// </summary>
public sealed class WarrantyRequestStore(Sql sql)
{
    private const string Columns = "MaYeuCau, MaKH, HoTenKhach, SDTKhach, EmailKhach, DiaChiKhach, MaNhom, MaLoai, HangModel, LoaiDinhDanh, "
        + "SoSerial_IMEI, MoTaLoi, MaTramMongMuon, ThoiGianMongMuonTu, ThoiGianMongMuonDen, TrangThai, MaPhieuTN, MaNVXuLy, NgayXuLy, LyDoHuy, NgayTao";

    public async Task<List<Dictionary<string, object?>>> SearchAsync(string? status, string? query)
    {
        var where = " WHERE 1 = 1";
        var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(status))
        {
            where += " AND TrangThai = ?";
            args.Add(status);
        }
        if (!string.IsNullOrWhiteSpace(query))
        {
            where += " AND (MaYeuCau LIKE ? OR HoTenKhach LIKE ? OR SDTKhach LIKE ? OR SoSerial_IMEI LIKE ?)";
            args.AddRange(Enumerable.Repeat<object?>(SqlLike.Contains(query.Trim()), 4));
        }
        var rows = await sql.QueryAsync($"SELECT {Columns} FROM YeuCauBaoHanh{where} ORDER BY NgayTao DESC, MaYeuCau DESC", Map, args.ToArray());
        await AttachFilesAsync(rows);
        return rows;
    }

    public async Task<Dictionary<string, object?>?> FindAsync(string code)
    {
        var rows = await sql.QueryAsync($"SELECT {Columns} FROM YeuCauBaoHanh WHERE MaYeuCau = ?", Map, code);
        await AttachFilesAsync(rows);
        return rows.FirstOrDefault();
    }

    /// <summary>Yêu cầu của khách (gắn MaKH, hoặc gửi vãng lai bằng SĐT này đã chuẩn hóa), mới nhất trước — không kèm tệp.</summary>
    public Task<List<Dictionary<string, object?>>> FindByCustomerAsync(string customerId, string phone) =>
        sql.QueryAsync($"SELECT {Columns} FROM YeuCauBaoHanh WHERE MaKH = ? OR SDTKhach = ? ORDER BY NgayTao DESC, MaYeuCau DESC", Map, customerId, phone);

    public async Task<bool> IsPendingAsync(string code) =>
        await sql.ScalarAsync("SELECT 1 FROM YeuCauBaoHanh WHERE MaYeuCau = ? AND TrangThai = 'PENDING_INTAKE'", code) is not null;

    public async Task RequirePendingAsync(string code)
    {
        if (!await IsPendingAsync(code)) throw new DomainException(ErrorCode.WARRANTY_REQUEST_NOT_PENDING);
    }

    public Task InsertAsync(NewWarrantyRequest request) =>
        sql.ExecuteAsync(
            "INSERT INTO YeuCauBaoHanh (MaYeuCau, MaKH, HoTenKhach, SDTKhach, EmailKhach, DiaChiKhach, MaNhom, MaLoai, HangModel, LoaiDinhDanh, "
            + "SoSerial_IMEI, MoTaLoi, MaTramMongMuon, ThoiGianMongMuonTu, ThoiGianMongMuonDen, TrangThai, NgayTao) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_INTAKE', ?)",
            request.Code, request.CustomerId, request.FullName, request.Phone, request.Email, request.Address, request.CategoryCode, request.DeviceTypeCode,
            request.BrandModel, request.IdentifierType, request.SerialOrImei, request.Symptom, request.PreferredStation,
            request.PreferredFrom, request.PreferredTo, request.CreatedAt);

    public Task CancelAsync(string code, string reason, string? employeeId, DateTimeOffset now) =>
        sql.ExecuteAsync(
            "UPDATE YeuCauBaoHanh SET TrangThai = 'CANCELLED', LyDoHuy = ?, MaNVXuLy = ?, NgayXuLy = ? WHERE MaYeuCau = ? AND TrangThai = 'PENDING_INTAKE'",
            reason.Length > 255 ? reason[..255] : reason, employeeId, now, code);

    /// <summary>Gọi sau khi phiếu tiếp nhận đã được ghi (khóa ngoại MaPhieuTN).</summary>
    public async Task ConvertAsync(string code, string ticketCode, string? employeeId, DateTimeOffset now)
    {
        var updated = await sql.ExecuteAsync(
            "UPDATE YeuCauBaoHanh SET TrangThai = 'CONVERTED', MaPhieuTN = ?, MaNVXuLy = ?, NgayXuLy = ? WHERE MaYeuCau = ? AND TrangThai = 'PENDING_INTAKE'",
            ticketCode, employeeId, now, code);
        if (updated != 1) throw new DomainException(ErrorCode.WARRANTY_REQUEST_NOT_PENDING);
    }

    private static Dictionary<string, object?> Map(DbDataReader row) => new()
    {
        ["_id"] = row.Str("MaYeuCau"),
        ["customerId"] = row.Str("MaKH"),
        ["customer"] = new Dictionary<string, object?>
        {
            ["fullName"] = row.Str("HoTenKhach"),
            ["phone"] = row.Str("SDTKhach"),
            ["email"] = row.Str("EmailKhach"),
            ["address"] = row.Str("DiaChiKhach"),
        },
        ["categoryCode"] = row.Str("MaNhom"),
        ["deviceTypeCode"] = row.Str("MaLoai"),
        ["brandModel"] = row.Str("HangModel"),
        ["identifierType"] = row.Str("LoaiDinhDanh"),
        ["serialOrImei"] = row.Str("SoSerial_IMEI"),
        ["symptom"] = row.Str("MoTaLoi"),
        ["attachments"] = new List<Dictionary<string, object?>>(),
        ["preferredStation"] = row.Str("MaTramMongMuon"),
        ["preferredFrom"] = row.Time("ThoiGianMongMuonTu"),
        ["preferredTo"] = row.Time("ThoiGianMongMuonDen"),
        ["status"] = row.Str("TrangThai"),
        ["convertedTicketId"] = row.Str("MaPhieuTN"),
        ["handledBy"] = row.Str("MaNVXuLy"),
        ["handledAt"] = row.Time("NgayXuLy"),
        ["cancelReason"] = row.Str("LyDoHuy"),
        ["createdAt"] = row.Time("NgayTao"),
    };

    private async Task AttachFilesAsync(List<Dictionary<string, object?>> rows)
    {
        foreach (var chunk in SqlInList.Chunks(rows))
        {
            var byCode = chunk.ToDictionary(row => (string)row["_id"]!);
            var files = await sql.QueryAsync(
                "SELECT MaTep, MaChuSoHuu, TenTep, LoaiNoiDung, KichThuoc FROM TepDinhKem WHERE LoaiChuSoHuu = 'WARRANTY_REQUEST' "
                + $"AND MaChuSoHuu IN ({string.Join(", ", byCode.Keys.Select(_ => "?"))}) ORDER BY MaTep",
                row => (Owner: row.Str("MaChuSoHuu")!, File: new Dictionary<string, object?>
                {
                    ["fileId"] = row.Long("MaTep").ToString(),
                    ["fileName"] = row.Str("TenTep"),
                    ["contentType"] = row.Str("LoaiNoiDung"),
                    ["size"] = row.Long("KichThuoc"),
                }),
                byCode.Keys.Cast<object?>().ToArray());
            foreach (var (owner, file) in files) ((List<Dictionary<string, object?>>)byCode[owner]["attachments"]!).Add(file);
        }
    }
}
