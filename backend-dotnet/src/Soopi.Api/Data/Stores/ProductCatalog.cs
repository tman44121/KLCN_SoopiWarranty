using System.Data.Common;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

public sealed record ProductInfo(
    string Id,
    string BrandId,
    IReadOnlyDictionary<string, string?> Snapshot,
    int DefaultWarrantyMonths,
    string? PolicyId,
    int? PolicyWarrantyMonths,
    string? Conditions,
    string? RejectionCases,
    string? Distributor);

/// <summary>Sản phẩm + hãng + loại thiết bị + chính sách bảo hành hiệu lực (ưu tiên theo sản phẩm, sau đó theo hãng).</summary>
public sealed class ProductCatalog(Sql sql)
{
    public async Task<ProductInfo> RequireProductAsync(string productId)
    {
        var product = await sql.FirstOrDefaultAsync(
            "SELECT sp.MaSP, sp.TenSP, sp.MaHang, hs.TenHang, lt.MaNhom, lt.MaLoai, lt.TenLoai, lt.LoaiDinhDanh, "
            + "sp.ThoiHanBaoHanhMacDinhThang FROM SanPham sp JOIN HangSanXuat hs ON hs.MaHang = sp.MaHang "
            + "JOIN LoaiThietBi lt ON lt.MaLoai = sp.MaLoai WHERE sp.MaSP = ? AND sp.HoatDong = 1",
            row => (Snapshot: Snapshot(row), Months: row.Int("ThoiHanBaoHanhMacDinhThang")),
            productId);
        if (product.Snapshot is null) throw new DomainException(ErrorCode.NOT_FOUND);
        var brandId = product.Snapshot["brandId"]!;
        var policy = await sql.FirstOrDefaultAsync(
            "SELECT TOP 1 MaChinhSach, SoThangBaoHanh, DieuKienBaoHanh, TruongHopTuChoi, NhaPhanPhoi FROM ChinhSachBaoHanh "
            + "WHERE HoatDong = 1 AND ((PhamVi = 'PRODUCT' AND MaSP = ?) OR (PhamVi = 'BRAND' AND MaHang = ?)) "
            + "ORDER BY CASE PhamVi WHEN 'PRODUCT' THEN 0 ELSE 1 END, MaChinhSach",
            row => (Id: row.Str("MaChinhSach")!, Months: row.Int("SoThangBaoHanh"), Conditions: row.Str("DieuKienBaoHanh"),
                Rejection: row.Str("TruongHopTuChoi"), Distributor: row.Str("NhaPhanPhoi")),
            productId, brandId);
        return new ProductInfo(
            productId, brandId, product.Snapshot, product.Months,
            policy.Id, policy.Id is null ? null : policy.Months, policy.Conditions, policy.Rejection, policy.Distributor);
    }

    private static IReadOnlyDictionary<string, string?> Snapshot(DbDataReader row) => new Dictionary<string, string?>
    {
        ["name"] = row.Str("TenSP"),
        ["brandId"] = row.Str("MaHang"),
        ["brandName"] = row.Str("TenHang"),
        ["categoryCode"] = row.Str("MaNhom"),
        ["deviceTypeCode"] = row.Str("MaLoai"),
        ["deviceTypeName"] = row.Str("TenLoai"),
        ["identifierType"] = row.Str("LoaiDinhDanh"),
    };
}
