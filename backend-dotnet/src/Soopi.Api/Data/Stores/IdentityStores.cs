using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

/// <summary>Hồ sơ nhân viên (bảng NhanVien) mà Quản trị viên quản lý cùng tài khoản đăng nhập.</summary>
public sealed record EmployeeRecord(
    string Code,
    string FullName,
    string Phone,
    string? Email,
    string? Specialty,
    IReadOnlyList<string> Skills,
    int MaxActiveTickets,
    bool OnSite,
    string WorkStatus,
    string StationCode,
    long? AccountId);

/// <summary>Bảng NhanVien; KyNang là mảng JSON.</summary>
public sealed class EmployeeRecordStore(Sql sql)
{
    private const string Columns = "MaNV, HoTen, SDT, Email, ChuyenMon, KyNang, SoPhieuToiDa, CoMatTaiTram, "
        + "TrangThaiLamViec, MaTram, MaTaiKhoan";

    public Task<List<EmployeeRecord>> FindAllAsync() => sql.QueryAsync("SELECT " + Columns + " FROM NhanVien ORDER BY MaNV", Map);

    public Task<EmployeeRecord?> FindAsync(string code) =>
        sql.FirstOrDefaultAsync("SELECT " + Columns + " FROM NhanVien WHERE MaNV = ?", Map, code);

    public Task SaveAsync(EmployeeRecord record) =>
        sql.ExecuteAsync(
            "MERGE NhanVien WITH (HOLDLOCK) AS t USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) AS n (" + Columns + ") "
            + "ON t.MaNV = n.MaNV "
            + "WHEN MATCHED THEN UPDATE SET HoTen = n.HoTen, SDT = n.SDT, Email = n.Email, "
            + "ChuyenMon = n.ChuyenMon, KyNang = n.KyNang, SoPhieuToiDa = n.SoPhieuToiDa, "
            + "CoMatTaiTram = n.CoMatTaiTram, TrangThaiLamViec = n.TrangThaiLamViec, "
            + "MaTram = n.MaTram, MaTaiKhoan = n.MaTaiKhoan "
            + "WHEN NOT MATCHED THEN INSERT (" + Columns + ") VALUES (n.MaNV, n.HoTen, n.SDT, n.Email, "
            + "n.ChuyenMon, n.KyNang, n.SoPhieuToiDa, n.CoMatTaiTram, n.TrangThaiLamViec, n.MaTram, n.MaTaiKhoan);",
            record.Code,
            record.FullName,
            record.Phone,
            record.Email,
            record.Specialty,
            JsonText.Write(record.Skills),
            record.MaxActiveTickets,
            record.OnSite,
            record.WorkStatus,
            record.StationCode,
            record.AccountId);

    private static EmployeeRecord Map(System.Data.Common.DbDataReader row) =>
        new(
            row.Str("MaNV")!,
            row.Str("HoTen")!,
            row.Str("SDT")!,
            row.Str("Email"),
            row.Str("ChuyenMon"),
            JsonText.Strings(row.Str("KyNang")),
            row.Int("SoPhieuToiDa"),
            row.Bool("CoMatTaiTram"),
            row.Str("TrangThaiLamViec")!,
            row.Str("MaTram")!,
            row.LongOrNull("MaTaiKhoan"));
}

public sealed record CustomerProfile(string Code, string FullName, long? AccountId);

/// <summary>Hồ sơ KhachHang mà luồng tài khoản khách cần: tìm theo SĐT, tạo mới, gắn tài khoản.</summary>
public sealed class CustomerProfileStore(Sql sql)
{
    public Task<CustomerProfile?> FindActiveByPhoneAsync(string phone) =>
        sql.FirstOrDefaultAsync(
            "SELECT MaKH, HoTen, MaTaiKhoan FROM KhachHang WHERE SDT = ? AND TrangThai = 'ACTIVE'",
            row => new CustomerProfile(row.Str("MaKH")!, row.Str("HoTen")!, row.LongOrNull("MaTaiKhoan")),
            phone);

    public Task CreateAsync(string code, string fullName, string phone, string? email, DateTimeOffset now) =>
        sql.ExecuteAsync("INSERT INTO KhachHang (MaKH, HoTen, SDT, Email, NgayTao) VALUES (?, ?, ?, ?, ?)", code, fullName, phone, email, now);

    /// <summary>Chỉ gắn khi hồ sơ chưa có tài khoản — hai lượt đăng ký song song thì lượt sau thất bại.</summary>
    public async Task LinkAccountAsync(string customerCode, long accountId)
    {
        var updated = await sql.ExecuteAsync(
            "UPDATE KhachHang SET MaTaiKhoan = ? WHERE MaKH = ? AND MaTaiKhoan IS NULL", accountId, customerCode);
        if (updated != 1) throw new DomainException(ErrorCode.CUSTOMER_ACCOUNT_EXISTS);
    }
}

public sealed record PendingOtp(long Id, string CodeHash, int FailedAttempts);

/// <summary>Bảng MaXacThucOTP: chỉ lưu SHA-256 của mã.</summary>
public sealed class OtpStore(Sql sql, TransactionRunner transactions)
{
    /// <summary>Vô hiệu mọi mã chưa dùng của SĐT + mục đích rồi lưu mã mới; trả về mã số bản ghi.</summary>
    public Task<long> ReplaceAsync(string phone, string purpose, string codeHash, DateTimeOffset now, DateTimeOffset expiresAt, string? clientIp) =>
        transactions.InTransactionAsync(async () =>
        {
            await sql.ExecuteAsync(
                "UPDATE MaXacThucOTP SET DaDungLuc = ? WHERE SDT = ? AND MucDich = ? AND DaDungLuc IS NULL", now, phone, purpose);
            var id = await sql.ScalarAsync(
                "INSERT INTO MaXacThucOTP (SDT, MucDich, MaHash, NgayTao, HetHan, DiaChiIP) OUTPUT inserted.MaOTP VALUES (?, ?, ?, ?, ?, ?)",
                phone, purpose, codeHash, now, expiresAt, clientIp is null ? null : clientIp[..Math.Min(45, clientIp.Length)]);
            return Convert.ToInt64(id);
        });

    /// <summary>Mã mới nhất chưa dùng và chưa hết hạn.</summary>
    public Task<PendingOtp?> LatestAsync(string phone, string purpose, DateTimeOffset now) =>
        sql.FirstOrDefaultAsync(
            "SELECT TOP 1 MaOTP, MaHash, SoLanNhapSai FROM MaXacThucOTP WHERE SDT = ? AND MucDich = ? "
            + "AND DaDungLuc IS NULL AND HetHan > ? ORDER BY NgayTao DESC, MaOTP DESC",
            row => new PendingOtp(row.Long("MaOTP"), row.Str("MaHash")!, row.Int("SoLanNhapSai")),
            phone, purpose, now);

    public Task RecordFailureAsync(long id) =>
        sql.ExecuteAsync("UPDATE MaXacThucOTP SET SoLanNhapSai = SoLanNhapSai + 1 WHERE MaOTP = ?", id);

    /// <summary>Đánh dấu đã dùng; false nếu phiên khác vừa dùng trước (chống dùng hai lần).</summary>
    public async Task<bool> ConsumeAsync(long id, DateTimeOffset now) =>
        await sql.ExecuteAsync("UPDATE MaXacThucOTP SET DaDungLuc = ? WHERE MaOTP = ? AND DaDungLuc IS NULL", now, id) == 1;
}
