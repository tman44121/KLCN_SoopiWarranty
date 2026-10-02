using Soopi.Api.Data;

namespace Soopi.Api.Services.Shared;

/// <summary>Ghi bảng NhatKyThaoTac — chỉ ghi thêm (tài khoản ứng dụng bị DENY UPDATE/DELETE, D-080).</summary>
public sealed class AuditService(Sql sql, TimeProvider clock)
{
    public Task RecordAsync(
        string? actorId,
        string? actorName,
        IEnumerable<string>? actorRoles,
        string action,
        string? actionLabel,
        string entityType,
        string? entityId,
        string? before = null,
        string? after = null) =>
        sql.ExecuteAsync(
            "INSERT INTO NhatKyThaoTac (ThoiGian, MaNguoiThaoTac, TenNguoiThaoTac, VaiTro, HanhDong, NhanHanhDong, "
            + "LoaiDoiTuong, MaDoiTuong, GiaTriTruoc, GiaTriSau) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            clock.GetUtcNow(),
            Limit(actorId ?? "SYSTEM", 30),
            Limit(actorName, 100),
            Limit(actorRoles is null ? null : string.Join(",", actorRoles), 200),
            Limit(action, 50),
            Limit(actionLabel ?? action, 100),
            Limit(entityType, 30),
            Limit(entityId ?? "—", 30),
            Limit(before, 500),
            Limit(after, 500));

    private static string? Limit(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
