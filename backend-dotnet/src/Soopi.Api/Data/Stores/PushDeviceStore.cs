namespace Soopi.Api.Data.Stores;

/// <summary>Bảng ThietBiNhanThongBao: lượt cài app nhận push của từng tài khoản.</summary>
public sealed class PushDeviceStore(Sql sql)
{
    /// <summary>Gắn lượt cài vào tài khoản (chuyển chủ nếu đã thuộc tài khoản khác); token chỉ thuộc một lượt cài.</summary>
    public async Task UpsertAsync(
        string installationId, long accountId, string platform, string pushToken, string? appVersion, DateTimeOffset now)
    {
        // FCM có thể cấp lại đúng token cũ cho lượt cài mới (cài lại app): token chỉ được thuộc một lượt cài.
        await sql.ExecuteAsync("DELETE FROM ThietBiNhanThongBao WHERE PushToken = ? AND MaCaiDat <> ?", pushToken, installationId);
        await sql.ExecuteAsync(
            "MERGE ThietBiNhanThongBao WITH (HOLDLOCK) AS t USING (VALUES (?, ?, ?, ?, ?, ?, ?)) AS moi "
            + "(MaCaiDat, MaTaiKhoan, NenTang, PushToken, PhienBanApp, NgayDangKy, NgayCapNhat) "
            + "ON t.MaCaiDat = moi.MaCaiDat WHEN MATCHED THEN UPDATE SET "
            + "MaTaiKhoan = moi.MaTaiKhoan, NenTang = moi.NenTang, PushToken = moi.PushToken, "
            + "PhienBanApp = moi.PhienBanApp, NgayCapNhat = moi.NgayCapNhat "
            + "WHEN NOT MATCHED THEN INSERT (MaCaiDat, MaTaiKhoan, NenTang, PushToken, PhienBanApp, "
            + "NgayDangKy, NgayCapNhat) VALUES (moi.MaCaiDat, moi.MaTaiKhoan, moi.NenTang, moi.PushToken, "
            + "moi.PhienBanApp, moi.NgayDangKy, moi.NgayCapNhat);",
            installationId, accountId, platform, pushToken, appVersion, now, now);
    }

    public Task DeleteAsync(string installationId, long accountId) =>
        sql.ExecuteAsync("DELETE FROM ThietBiNhanThongBao WHERE MaCaiDat = ? AND MaTaiKhoan = ?", installationId, accountId);

    public Task DeleteAllAsync(long accountId) =>
        sql.ExecuteAsync("DELETE FROM ThietBiNhanThongBao WHERE MaTaiKhoan = ?", accountId);

    public Task DeleteTokenAsync(string pushToken) =>
        sql.ExecuteAsync("DELETE FROM ThietBiNhanThongBao WHERE PushToken = ?", pushToken);

    public Task<List<string>> TokensOfAsync(long accountId) =>
        sql.QueryAsync(
            "SELECT PushToken FROM ThietBiNhanThongBao WHERE MaTaiKhoan = ? ORDER BY NgayCapNhat DESC",
            row => row.Str("PushToken")!,
            accountId);
}
