using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Reporting;

/// <summary>Cột UI: Thời gian, Người thao tác, Vai trò, Hành động, Giá trị trước, Giá trị sau.</summary>
public sealed record AuditEntryView(
    DateTimeOffset? At, string ActorId, string? ActorName, IReadOnlyList<string> ActorRoles, string Action, string ActionLabel, string EntityType,
    string EntityId, string? Before, string? After);

/// <summary>R13 — "Lịch sử thao tác". Nhật ký chỉ ghi thêm: module chỉ có API đọc, không có sửa/xóa.</summary>
public sealed class AuditQueryService(Sql sql, CurrentActor actors)
{
    private static readonly HashSet<string> SortFields = ["at"];

    public async Task<PageResponse<AuditEntryView>> SearchAsync(
        string? entityType, string? entityId, string? actor, DateTimeOffset? from, DateTimeOffset? to, PageRequestParams paging)
    {
        actors.Require(Permission.AUDIT_READ);
        paging.Validate();
        var direction = paging.ParseSort(SortFields, "at", defaultDescending: true).Descending ? "DESC" : "ASC";
        var where = " WHERE 1 = 1";
        var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(entityType))
        {
            where += " AND LoaiDoiTuong = ?";
            args.Add(entityType);
        }
        if (!string.IsNullOrWhiteSpace(entityId))
        {
            where += " AND MaDoiTuong = ?";
            args.Add(entityId);
        }
        if (!string.IsNullOrWhiteSpace(actor))
        {
            where += " AND (MaNguoiThaoTac = ? OR TenNguoiThaoTac LIKE ?)";
            args.Add(actor.Trim());
            args.Add(SqlLike.Contains(actor.Trim()));
        }
        if (from is { } f)
        {
            where += " AND ThoiGian >= ?";
            args.Add(f);
        }
        if (to is { } t)
        {
            where += " AND ThoiGian < ?";
            args.Add(t);
        }
        var total = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT(*) FROM NhatKyThaoTac" + where, [.. args]));
        var items = await sql.QueryAsync(
            "SELECT ThoiGian, MaNguoiThaoTac, TenNguoiThaoTac, VaiTro, HanhDong, NhanHanhDong, LoaiDoiTuong, MaDoiTuong, GiaTriTruoc, GiaTriSau "
            + $"FROM NhatKyThaoTac{where} ORDER BY ThoiGian {direction}, MaNhatKy {direction} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            row => new AuditEntryView(row.Time("ThoiGian"), row.Str("MaNguoiThaoTac")!, row.Str("TenNguoiThaoTac"),
                string.IsNullOrWhiteSpace(row.Str("VaiTro")) ? [] : row.Str("VaiTro")!.Split(','), row.Str("HanhDong")!, row.Str("NhanHanhDong")!,
                row.Str("LoaiDoiTuong")!, row.Str("MaDoiTuong")!, row.Str("GiaTriTruoc"), row.Str("GiaTriSau")),
            [.. args, (long)paging.Offset, paging.Size]);
        return PageResponse<AuditEntryView>.Of(items, paging.Page, paging.Size, total);
    }
}
