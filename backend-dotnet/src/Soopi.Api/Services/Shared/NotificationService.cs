using Soopi.Api.Data;

namespace Soopi.Api.Services.Shared;

/// <summary>
/// Thông báo in-app (bảng ThongBao): gửi cho một vai trò hoặc một tài khoản. Thông báo gửi tới một tài khoản còn được đẩy ra
/// các thiết bị di động mà tài khoản đó đã đăng ký nhận push. Đường dẫn lưu theo route React (thông báo cũ trong DB vẫn
/// là đường dẫn *.html, frontend tự dịch).
/// </summary>
public sealed class NotificationService(Sql sql, TimeProvider clock, PushDispatcher pushes)
{
    public const string CustomerPortal = "/portal";

    public Task ForRoleAsync(string role, string type, string message, string? link, string? entityId) =>
        InsertAsync(role, null, type, message, link, entityId);

    public Task ForAccountAsync(string? accountId, string type, string message, string? link, string? entityId) =>
        string.IsNullOrWhiteSpace(accountId)
            ? Task.CompletedTask
            : InsertAsync(null, long.Parse(accountId), type, message, link, entityId);

    public async Task ForEmployeeAsync(string employeeId, string type, string message, string? link, string? entityId)
    {
        var accounts = await sql.QueryAsync("SELECT MaTaiKhoan FROM NhanVien WHERE MaNV = ?", row => row.LongOrNull("MaTaiKhoan"), employeeId);
        if (accounts.FirstOrDefault(account => account is not null) is { } account)
            await InsertAsync(null, account, type, message, link, entityId);
    }

    /// <summary>Khách chưa có tài khoản (hoặc tài khoản bị khóa) thì không có ai nhận — không phải lỗi.</summary>
    public async Task ForCustomerAsync(string customerId, string type, string message, string? entityId)
    {
        var accounts = await sql.QueryAsync(
            "SELECT tk.MaTaiKhoan FROM KhachHang kh JOIN TaiKhoan tk ON tk.MaTaiKhoan = kh.MaTaiKhoan "
            + "WHERE kh.MaKH = ? AND tk.TrangThai = 'ACTIVE'",
            row => row.Long("MaTaiKhoan"),
            customerId);
        if (accounts.Count > 0) await InsertAsync(null, accounts[0], type, message, CustomerPortal, entityId);
    }

    /// <summary>Yêu cầu bảo hành online chỉ lưu SĐT người gửi: tìm tài khoản của hồ sơ khách đang dùng SĐT đó.</summary>
    public async Task ForCustomerPhoneAsync(string phone, string type, string message, string? entityId)
    {
        var accounts = await sql.QueryAsync(
            "SELECT tk.MaTaiKhoan FROM KhachHang kh JOIN TaiKhoan tk ON tk.MaTaiKhoan = kh.MaTaiKhoan "
            + "WHERE kh.SDT = ? AND kh.TrangThai = 'ACTIVE' AND tk.TrangThai = 'ACTIVE'",
            row => row.Long("MaTaiKhoan"),
            phone);
        if (accounts.Count > 0) await InsertAsync(null, accounts[0], type, message, CustomerPortal, entityId);
    }

    public async Task<bool> ExistsAsync(string type, string entityId) =>
        await sql.ScalarAsync("SELECT TOP 1 1 FROM ThongBao WHERE Loai = ? AND MaDoiTuong = ?", type, entityId) is not null;

    private async Task InsertAsync(string? role, long? accountId, string type, string message, string? link, string? entityId)
    {
        var storedType = Limit(type, 40)!;
        var storedMessage = Limit(message, 255)!;
        var storedEntity = Limit(entityId, 30);
        var id = await sql.ScalarAsync(
            "INSERT INTO ThongBao (MaVaiTroNhan, MaTaiKhoanNhan, Loai, NoiDung, DuongDan, MaDoiTuong, NgayTao) "
            + "OUTPUT inserted.MaThongBao VALUES (?, ?, ?, ?, ?, ?, ?)",
            role, accountId, storedType, storedMessage, Limit(link, 255), storedEntity, clock.GetUtcNow());
        if (accountId is not null)
            pushes.Dispatch(accountId.Value, Convert.ToInt64(id), storedType, storedMessage, storedEntity);
    }

    private static string? Limit(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
