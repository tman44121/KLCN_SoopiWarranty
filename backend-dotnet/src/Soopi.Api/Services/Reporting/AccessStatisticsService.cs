using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Reporting;

public sealed record AccessFilters(DateOnly? From = null, DateOnly? To = null, string? Kind = null, string? Role = null, string? Q = null);
public sealed record AccessDay(DateOnly Day, long Visits, long Accounts, long Logins, long Failed);
public sealed record AccessSummary(DateOnly TrackingStart, DateOnly From, DateOnly To, DateTimeOffset GeneratedAt,
    long TotalVisits, long Visits, long Accounts, long Online, long Logins, long Failed, IReadOnlyList<AccessDay> Days);
public sealed record OnlineAccount(string AccountId, string Username, string FullName, string Kind, string Roles,
    DateTimeOffset? StartedAt, DateTimeOffset? LastSeenAt, long Sessions);
public sealed record AccessLog(string Id, DateTimeOffset? At, string? AccountId, string Username, string FullName, string Kind,
    string Roles, string Action, string Label);

public sealed class AccessStatisticsService(Sql sql, CurrentActor actors, AccessTrackingService tracking, TimeProvider clock)
{
    private const string Profiles = " LEFT JOIN NhanVien e ON e.MaTaiKhoan=a.MaTaiKhoan LEFT JOIN KhachHang k ON k.MaTaiKhoan=a.MaTaiKhoan ";
    private const string Visits = " FROM LuotTruyCap v JOIN TaiKhoan a ON a.MaTaiKhoan=v.MaTaiKhoan " + Profiles;
    private const string Days = " FROM TruyCapTheoNgay d JOIN TaiKhoan a ON a.MaTaiKhoan=d.MaTaiKhoan " + Profiles;
    private const string Logs = " FROM NhatKyThaoTac n LEFT JOIN TaiKhoan a ON a.MaTaiKhoan=TRY_CONVERT(BIGINT,n.MaDoiTuong) AND ISNULL(n.VaiTro,'')<>'ANONYMOUS' " + Profiles;
    private const string LogActions = " AND n.LoaiDoiTuong='ACCOUNT' AND n.HanhDong IN ('AUTH_LOGIN_SUCCESS','AUTH_LOGIN_FAILED','AUTH_LOGOUT','AUTH_LOGOUT_ALL') ";
    private const string LogKind = "CASE WHEN n.VaiTro='ANONYMOUS' THEN 'UNKNOWN' WHEN ','+ISNULL(n.VaiTro,'')+',' LIKE '%,CUSTOMER,%' THEN 'CUSTOMER' ELSE 'EMPLOYEE' END";
    public const int ExportLimit = 10000;

    private void Admin()
    {
        if (!actors.RequireSignedIn().Roles.Contains(Role.ADMIN)) throw new DomainException(ErrorCode.ACCESS_DENIED);
    }

    public static void Validate(AccessFilters filter)
    {
        if (filter.Q?.Length > 100 || filter.Kind is not (null or "" or "EMPLOYEE" or "CUSTOMER")
            || (!string.IsNullOrEmpty(filter.Role) && (!Enum.TryParse<Role>(filter.Role, out var role) || !Enum.IsDefined(role) || role.ToString() != filter.Role))
            || filter.To == DateOnly.MaxValue || filter.From > filter.To)
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
    }

    private static void Paging(int page, int size)
    {
        new PageRequestParams(page, size, null).Validate();
        if (page > int.MaxValue / size) throw new DomainException(ErrorCode.VALIDATION_FAILED);
    }

    private static (string Where, object?[] Args) Filter(AccessFilters f, bool log = false)
    {
        Validate(f);
        var where = "";
        var args = new List<object?>();
        if (!string.IsNullOrEmpty(f.Kind)) { where += " AND " + (log ? LogKind : "a.LoaiChuThe") + "=?"; args.Add(f.Kind); }
        if (!string.IsNullOrEmpty(f.Role))
        {
            where += log ? " AND ','+ISNULL(n.VaiTro,'')+',' LIKE ?" : " AND EXISTS (SELECT 1 FROM TaiKhoan_VaiTro r WHERE r.MaTaiKhoan=a.MaTaiKhoan AND r.MaVaiTro=?)";
            args.Add(log ? "%," + f.Role + ",%" : f.Role);
        }
        if (!string.IsNullOrWhiteSpace(f.Q))
        {
            where += log ? " AND (n.TenNguoiThaoTac LIKE ? OR COALESCE(e.HoTen,k.HoTen) LIKE ? OR n.MaNguoiThaoTac LIKE ?)"
                : " AND (a.TenDangNhap LIKE ? OR COALESCE(e.HoTen,k.HoTen) LIKE ? OR COALESCE(e.MaNV,k.MaKH) LIKE ?)";
            var pattern = SqlLike.Contains(f.Q.Trim()); args.AddRange([pattern, pattern, pattern]);
        }
        return (where, args.ToArray());
    }

    private async Task<(DateOnly Start, DateOnly From, DateOnly To)> Range(AccessFilters f)
    {
        Validate(f);
        var start = await tracking.StartDateAsync();
        var from = f.From ?? start;
        var to = f.To ?? DbTime.Date(clock.GetUtcNow());
        if (from < start || to < from || to == DateOnly.MaxValue) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return (start, from, to);
    }

    public async Task<AccessSummary> SummaryAsync(AccessFilters filter)
    {
        Admin();
        var (start, from, to) = await Range(filter);
        var (where, args) = Filter(filter);
        var (logWhere, logArgs) = Filter(filter, log: true);
        var end = to.AddDays(1);
        var visits = await sql.QueryAsync("SELECT CONVERT(DATE,v.BatDau) AS Ngay,COUNT_BIG(*) AS N" + Visits
            + " WHERE v.BatDau>=? AND v.BatDau<?" + where + " GROUP BY CONVERT(DATE,v.BatDau)", r => (Day: r.Date("Ngay")!.Value, Count: r.Long("N")), [from, end, .. args]);
        var days = await sql.QueryAsync("SELECT d.Ngay,COUNT_BIG(*) AS N" + Days + " WHERE d.Ngay>=? AND d.Ngay<?" + where + " GROUP BY d.Ngay",
            r => (Day: r.Date("Ngay")!.Value, Count: r.Long("N")), [from, end, .. args]);
        var logins = await sql.QueryAsync("SELECT CONVERT(DATE,n.ThoiGian) AS Ngay,COUNT_BIG(CASE WHEN n.HanhDong='AUTH_LOGIN_SUCCESS' THEN 1 END) AS OK,COUNT_BIG(CASE WHEN n.HanhDong='AUTH_LOGIN_FAILED' THEN 1 END) AS Failed"
            + Logs + " WHERE n.ThoiGian>=? AND n.ThoiGian<?" + LogActions + logWhere + " GROUP BY CONVERT(DATE,n.ThoiGian)",
            r => (Day: r.Date("Ngay")!.Value, Ok: r.Long("OK"), Failed: r.Long("Failed")), [from, end, .. logArgs]);
        var total = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*)" + Visits + " WHERE v.BatDau>=?" + where, [start, .. args]));
        var accounts = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(DISTINCT d.MaTaiKhoan)" + Days + " WHERE d.Ngay>=? AND d.Ngay<?" + where, [from, end, .. args]));
        var visitDays = visits.ToDictionary(x => x.Day, x => x.Count);
        var activeDays = days.ToDictionary(x => x.Day, x => x.Count);
        var loginDays = logins.ToDictionary(x => x.Day);
        var series = visitDays.Keys.Concat(activeDays.Keys).Concat(loginDays.Keys).Distinct().Order()
            .Select(day => new AccessDay(day, visitDays.GetValueOrDefault(day), activeDays.GetValueOrDefault(day),
                loginDays.GetValueOrDefault(day).Ok, loginDays.GetValueOrDefault(day).Failed)).ToList();
        return new(start, from, to, clock.GetUtcNow(), total, visits.Sum(x => x.Count), accounts, (await OnlineAsync(filter, 0, 25)).TotalItems,
            logins.Sum(x => x.Ok), logins.Sum(x => x.Failed), series);
    }

    public async Task<PageResponse<OnlineAccount>> OnlineAsync(AccessFilters filter, int page, int size)
    {
        Admin(); Paging(page, size);
        var (where, args) = Filter(filter);
        var now = clock.GetUtcNow();
        var source = Visits + " WHERE v.KetThuc IS NULL AND v.HoatDongCuoi>? AND a.TrangThai='ACTIVE' "
            + "AND (e.TrangThaiLamViec='ACTIVE' OR k.TrangThai='ACTIVE') AND EXISTS (SELECT 1 FROM RefreshToken r WHERE r.HoToken=v.MaPhien AND r.MaTaiKhoan=a.MaTaiKhoan AND r.ThuHoiLuc IS NULL AND r.HetHan>?)" + where;
        var total = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(DISTINCT a.MaTaiKhoan)" + source, [now - AccessTrackingService.OnlineWindow, now, .. args]));
        var rows = await sql.QueryAsync("SELECT a.MaTaiKhoan,a.TenDangNhap,COALESCE(e.HoTen,k.HoTen,a.TenDangNhap) AS HoTen,a.LoaiChuThe,"
            + "(SELECT STRING_AGG(r.MaVaiTro,',') FROM TaiKhoan_VaiTro r WHERE r.MaTaiKhoan=a.MaTaiKhoan) AS Roles,"
            + "MIN(v.BatDau) AS BatDau,MAX(v.HoatDongCuoi) AS HoatDongCuoi,COUNT_BIG(*) AS Sessions" + source
            + " GROUP BY a.MaTaiKhoan,a.TenDangNhap,e.HoTen,k.HoTen,a.LoaiChuThe ORDER BY MAX(v.HoatDongCuoi) DESC,a.MaTaiKhoan OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            r => new OnlineAccount(r.Str("MaTaiKhoan")!, r.Str("TenDangNhap")!, r.Str("HoTen")!, r.Str("LoaiChuThe")!, r.Str("Roles") ?? "",
                r.Time("BatDau"), r.Time("HoatDongCuoi"), r.Long("Sessions")), [now - AccessTrackingService.OnlineWindow, now, .. args, page * size, size]);
        return PageResponse<OnlineAccount>.Of(rows, page, size, total);
    }

    public Task<PageResponse<AccessLog>> LogsAsync(AccessFilters filter, string? action, int page, int size)
    {
        Admin(); Paging(page, size);
        return QueryLogs(filter, action, page, size);
    }

    private async Task<PageResponse<AccessLog>> QueryLogs(AccessFilters filter, string? action, int page, int size)
    {
        if (action is not (null or "" or "AUTH_LOGIN_SUCCESS" or "AUTH_LOGIN_FAILED" or "AUTH_LOGOUT" or "AUTH_LOGOUT_ALL"))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var (_, from, to) = await Range(filter);
        var (where, filterArgs) = Filter(filter, log: true);
        var args = new List<object?> { from, to.AddDays(1) }; args.AddRange(filterArgs);
        if (!string.IsNullOrEmpty(action)) { where += " AND n.HanhDong=?"; args.Add(action); }
        var source = Logs + " WHERE n.ThoiGian>=? AND n.ThoiGian<?" + LogActions + where;
        var total = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*)" + source, args.ToArray()));
        var rows = await sql.QueryAsync("SELECT n.MaNhatKy,n.ThoiGian,a.MaTaiKhoan,n.TenNguoiThaoTac,COALESCE(e.HoTen,k.HoTen,n.TenNguoiThaoTac,n.MaNguoiThaoTac) AS HoTen,"
            + LogKind + " AS Kind,n.VaiTro,n.HanhDong,n.NhanHanhDong" + source
            + " ORDER BY n.ThoiGian DESC,n.MaNhatKy DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            r => new AccessLog(r.Str("MaNhatKy")!, r.Time("ThoiGian"), r.Str("MaTaiKhoan"), r.Str("TenNguoiThaoTac") ?? "—", r.Str("HoTen")!,
                r.Str("Kind")!, r.Str("VaiTro") ?? "", r.Str("HanhDong")!, r.Str("NhanHanhDong")!), [.. args, page * size, size]);
        return PageResponse<AccessLog>.Of(rows, page, size, total);
    }

    public async Task<byte[]> ExportAsync(AccessFilters filter, string? action)
    {
        Admin();
        var logs = await QueryLogs(filter, action, 0, ExportLimit + 1);
        if (logs.TotalItems > ExportLimit) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return ReportWorkbook.CreateAccess(await SummaryAsync(filter), logs.Items, filter, action);
    }
}
