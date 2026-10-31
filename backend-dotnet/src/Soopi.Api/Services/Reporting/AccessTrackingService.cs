using Soopi.Api.Data;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Reporting;

public sealed class AccessTrackingService(Sql sql, CurrentActor actors, TransactionRunner transactions, TimeProvider clock)
{
    public static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan VisitTimeout = TimeSpan.FromMinutes(30);

    public async Task<DateOnly> StartDateAsync() => (await sql.QueryAsync("SELECT NgayBatDau FROM MocThongKeTruyCap WHERE Id=1", r => r.Date("NgayBatDau")!.Value)).Single();

    public async Task<bool> HeartbeatAsync()
    {
        var actor = actors.RequireSignedIn();
        if (actor.AccountId is not { } account) throw new DomainException(ErrorCode.ACCESS_DENIED);
        // Old access tokens gain a signed session id on their next refresh, without inventing a second visit.
        if (actors.SessionId is not { } session) return false;
        return await transactions.InTransactionAsync(async () =>
        {
            var now = clock.GetUtcNow();
            var day = DbTime.Date(now);
            if (day < await StartDateAsync()) return true;
            if (await sql.ScalarAsync("SELECT MaTaiKhoan FROM TaiKhoan WITH (UPDLOCK,HOLDLOCK) WHERE MaTaiKhoan=? AND TrangThai='ACTIVE'", account) is null)
                throw new DomainException(ErrorCode.AUTH_TOKEN_REVOKED);
            // A still-valid access JWT must not resurrect presence after logout of its refresh-token family.
            if (await sql.ScalarAsync("SELECT TOP 1 1 FROM RefreshToken WHERE MaTaiKhoan=? AND HoToken=? AND ThuHoiLuc IS NULL AND HetHan>?", account, session, now) is null)
                return false;
            var visit = await sql.FirstOrDefaultAsync("SELECT MaLuot,HoatDongCuoi FROM LuotTruyCap WHERE MaTaiKhoan=? AND MaPhien=? AND KetThuc IS NULL",
                r => new { Id = r.Long("MaLuot"), Last = r.Time("HoatDongCuoi")!.Value }, account, session);
            if (visit is not null && now - visit.Last >= VisitTimeout)
            {
                await sql.ExecuteAsync("UPDATE LuotTruyCap SET KetThuc=? WHERE MaLuot=?", visit.Last + VisitTimeout, visit.Id);
                visit = null;
            }
            if (visit is null)
                await sql.ExecuteAsync("INSERT LuotTruyCap (MaTaiKhoan,MaPhien,BatDau,HoatDongCuoi) VALUES (?,?,?,?)", account, session, now, now);
            else
                await sql.ExecuteAsync("UPDATE LuotTruyCap SET HoatDongCuoi=? WHERE MaLuot=? AND HoatDongCuoi<?", now, visit.Id, now);
            await sql.ExecuteAsync("""
                MERGE TruyCapTheoNgay WITH (HOLDLOCK) AS d USING (VALUES (?,?)) AS s (Ngay,MaTaiKhoan)
                ON d.Ngay=s.Ngay AND d.MaTaiKhoan=s.MaTaiKhoan
                WHEN NOT MATCHED THEN INSERT (Ngay,MaTaiKhoan) VALUES (s.Ngay,s.MaTaiKhoan);
                """, day, account);
            return true;
        });
    }

    public Task EndAsync(long account, string? session, DateTimeOffset now) => transactions.InTransactionAsync(async () =>
    {
        await sql.ScalarAsync("SELECT MaTaiKhoan FROM TaiKhoan WITH (UPDLOCK,HOLDLOCK) WHERE MaTaiKhoan=?", account);
        var where = session is null ? "" : " AND MaPhien=?";
        await sql.ExecuteAsync("UPDATE LuotTruyCap SET KetThuc=CASE WHEN HoatDongCuoi>? THEN HoatDongCuoi ELSE ? END WHERE MaTaiKhoan=? AND KetThuc IS NULL" + where,
            session is null ? [now, now, account] : [now, now, account, session]);
    });
}
