using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.DTOs.Shared;

namespace Soopi.Api.Services.Reporting;

public sealed record MonthlyRevenue(string Month, long Payments, decimal Total);

public sealed record TechnicianPerformance(
    string EmployeeId, string FullName, string? Specialty, long Assigned, long Completed, long Cancelled, decimal? AvgRating, decimal? FirstPassQcRate,
    decimal? AvgRepairHours);

public sealed record CategoryTurnaround(string CategoryCode, long Delivered, decimal? AvgHours);

public sealed record Turnaround(long Delivered, decimal? AvgHours, long? MinHours, long? MaxHours, IReadOnlyList<CategoryTurnaround> ByCategory);

public sealed record WarrantyRatio(long FreeWarranty, long Charged, decimal? FreeRatePercent);

public sealed record RepeatRepair(string TicketCode, string RepairOrderCode, string TechnicianId, string? TechnicianName, long Attempts, long FailedQc,
    DateTimeOffset? LastRecordedAt);

public sealed record QuotationMismatch(string QuotationCode, decimal PartsTotal, decimal LaborTotal, decimal GrandTotal, decimal PartsFromLines,
    decimal LaborFromLines, decimal ExpectedGrandTotal);

public sealed record StatusCount(string Status, long Count);

public sealed record SlaBucket(string Level, long Breached, long AtRisk, long OnTrack);

public sealed record CustomerReviewRow(string TicketCode, string CustomerCode, string FullName, string Phone,
    string? ProductName, string StationCode, string StationName, int Rating, string? Comment, DateTimeOffset? RatedAt, bool Published = false);

public sealed record CustomerReviewReport(PageResponse<CustomerReviewRow> Reviews, long CustomerReviewCount, decimal? AverageRating, long LegacyCount);

/// <summary>
/// Báo cáo mục 14 (R4–R12). Khoảng ngày theo giờ Việt Nam, gồm cả hai đầu; trạm tùy chọn. Số giờ = số giây / 3600 làm tròn
/// xuống (như TIMESTAMPDIFF(HOUR) của bản MySQL), không dùng DATEDIFF(HOUR) vì hàm đó đếm số lần qua mốc giờ.
/// </summary>
public sealed class ReportService(Sql sql, CurrentActor actors, TimeProvider clock, IConfiguration configuration)
{
    private sealed record Range(DateTimeOffset? From, DateTimeOffset? To, string? Station);

    public async Task<CustomerReviewReport> CustomerReviewsAsync(DateOnly? from, DateOnly? to, string? station, int? rating, string? query, int page, int size)
    {
        if (!actors.Require(Permission.REPORT_SYSTEM).Roles.Contains(Role.ADMIN)) throw new DomainException(ErrorCode.ACCESS_DENIED);
        new PageRequestParams(page, size, null).Validate();
        if (rating is < 1 or > 5 || query?.Length > 100 || page > int.MaxValue / size)
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var (where, args) = Filter("bg.NgayDanhGia", RangeOf(from, to, station));
        if (rating is not null) { where += " AND bg.DanhGiaHaiLong = ?"; args.Add(rating); }
        if (!string.IsNullOrWhiteSpace(query))
        {
            where += " AND (ptn.MaPhieuTN LIKE ? OR kh.HoTen LIKE ? OR kh.SDT LIKE ?)";
            var pattern = SqlLike.Contains(query.Trim());
            args.AddRange([pattern, pattern, pattern]);
        }
        const string joins = " FROM PhieuBanGiao bg JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = bg.MaPhieuTN "
            + "JOIN KhachHang kh ON kh.MaKH = ptn.MaKH JOIN TramDichVu tram ON tram.MaTram = ptn.MaTram "
            + "JOIN ThietBi tb ON tb.MaThietBi = ptn.MaThietBi JOIN SanPham sp ON sp.MaSP = tb.MaSP "
            + "WHERE bg.DanhGiaHaiLong IS NOT NULL AND ptn.TrangThaiXuLy IN ('DELIVERED', 'RETURNED_UNREPAIRED')";
        var summary = (await sql.QueryAsync("SELECT COUNT_BIG(*) AS Total, COUNT_BIG(bg.NgayDanhGia) AS CustomerCount, "
            + "AVG(CASE WHEN bg.NgayDanhGia IS NOT NULL THEN CAST(bg.DanhGiaHaiLong AS DECIMAL(10,2)) END) AS AverageRating" + joins + where,
            row => (Total: row.Long("Total"), Customers: row.Long("CustomerCount"), Average: row.DecOrNull("AverageRating")), [.. args]))[0];
        var rows = await sql.QueryAsync("SELECT ptn.MaPhieuTN, kh.MaKH, kh.HoTen, kh.SDT, sp.TenSP, tram.MaTram, tram.TenTram, "
            + "bg.DanhGiaHaiLong, bg.NhanXetDanhGia, bg.NgayDanhGia,CASE WHEN EXISTS (SELECT 1 FROM DanhGiaCongKhai pub WHERE pub.MaPhieuTN=bg.MaPhieuTN AND "
            + Services.Portal.PublicReviewService.Matches + ") THEN 1 ELSE 0 END AS CongKhai" + joins + where
            + " ORDER BY bg.NgayDanhGia DESC, ptn.MaPhieuTN DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            row => new CustomerReviewRow(row.Str("MaPhieuTN")!, row.Str("MaKH")!, row.Str("HoTen")!, row.Str("SDT")!, row.Str("TenSP"),
                row.Str("MaTram")!, row.Str("TenTram")!, row.Int("DanhGiaHaiLong"), row.Str("NhanXetDanhGia"), row.Time("NgayDanhGia"), row.Bool("CongKhai")),
            [.. args, page * size, size]);
        return new CustomerReviewReport(PageResponse<CustomerReviewRow>.Of(rows, page, size, summary.Total), summary.Customers,
            Scaled(summary.Average, 2), summary.Total - summary.Customers);
    }

    public async Task<byte[]> ExportAsync(DateOnly from, DateOnly to, string? station)
    {
        actors.Require(Permission.REPORT_SYSTEM);
        actors.Require(Permission.REPORT_OPERATIONS);
        if (to == DateOnly.MaxValue) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        RangeOf(from, to, station);
        // These queries share one scoped connection; execute sequentially, as in other report operations.
        var revenue = await RevenueMonthlyAsync(from, to, station);
        var statuses = await TicketsByStatusAsync(from, to, station);
        var turnaround = await TurnaroundAsync(from, to, station);
        var technicians = await TechnicianPerformanceAsync(from, to, station);
        var warranty = await WarrantyRatioAsync(from, to, station);
        return ReportWorkbook.Create(from, to, station, clock.GetUtcNow(), new(revenue, statuses, turnaround, technicians, warranty));
    }

    /// <summary>R4 — chỉ phiếu thu tính phí (miễn phí 0 đ không tính).</summary>
    public Task<List<MonthlyRevenue>> RevenueMonthlyAsync(DateOnly? from, DateOnly? to, string? station)
    {
        actors.Require(Permission.REPORT_SYSTEM);
        var (where, args) = Filter("ht.NgayThu", RangeOf(from, to, station));
        return sql.QueryAsync(
            "SELECT CONVERT(CHAR(7), ht.NgayThu, 126) AS Thang, COUNT(*) AS SoPhieu, SUM(ht.SoTienThu) AS TongTien FROM HoaDon_PhieuThu ht "
            + $"JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = ht.MaPhieuTN WHERE ht.LoaiThu = 'CHARGED'{where} GROUP BY CONVERT(CHAR(7), ht.NgayThu, 126) ORDER BY Thang DESC",
            row => new MonthlyRevenue(row.Str("Thang")!, row.Long("SoPhieu"), SqlMoney.Read(row.DecOrNull("TongTien") ?? 0)), [.. args]);
    }

    /// <summary>R5 — chỉ nhân viên có vai trò Kỹ thuật viên; điểm hài lòng giảm dần (chưa có điểm xếp cuối).</summary>
    public async Task<List<TechnicianPerformance>> TechnicianPerformanceAsync(DateOnly? from, DateOnly? to, string? station)
    {
        actors.Require(Permission.REPORT_OPERATIONS);
        var (where, args) = Filter("ptn.NgayTiepNhan", RangeOf(from, to, station));
        var rows = await sql.QueryAsync(
            "SELECT sc.MaKTV, nv.HoTen, nv.ChuyenMon, COUNT(*) AS assigned, SUM(CASE WHEN sc.TrangThaiSuaChua = 'DONE' THEN 1 ELSE 0 END) AS completed, "
            + "SUM(CASE WHEN sc.TrangThaiSuaChua = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled, "
            + "AVG(CASE WHEN sc.TrangThaiSuaChua = 'DONE' THEN 1.0 * bg.DanhGiaHaiLong END) AS avgRating, "
            + "SUM(CASE WHEN sc.TrangThaiSuaChua = 'DONE' AND fail.MaPhieuSC IS NULL THEN 1 ELSE 0 END) AS firstPass, "
            + "AVG(CASE WHEN sc.TrangThaiSuaChua = 'DONE' AND sc.NgayBatDau IS NOT NULL AND pass.PassAt IS NOT NULL "
            + $"THEN 1.0 * ({Hours("sc.NgayBatDau", "pass.PassAt")}) END) AS avgRepairHours "
            + "FROM PhieuSuaChua sc JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = sc.MaPhieuTN JOIN NhanVien nv ON nv.MaNV = sc.MaKTV "
            + "LEFT JOIN PhieuBanGiao bg ON bg.MaPhieuTN = ptn.MaPhieuTN "
            + "LEFT JOIN (SELECT DISTINCT MaPhieuSC FROM KetQuaSuaChua WHERE KetQuaKCS = 'FAIL') fail ON fail.MaPhieuSC = sc.MaPhieuSC "
            + "LEFT JOIN (SELECT MaPhieuSC, MAX(NgayGhiNhan) AS PassAt FROM KetQuaSuaChua WHERE KetQuaKCS = 'PASS' GROUP BY MaPhieuSC) pass "
            + "ON pass.MaPhieuSC = sc.MaPhieuSC WHERE EXISTS (SELECT 1 FROM TaiKhoan_VaiTro tv WHERE tv.MaTaiKhoan = nv.MaTaiKhoan "
            + $"AND tv.MaVaiTro = 'TECHNICIAN'){where} GROUP BY sc.MaKTV, nv.HoTen, nv.ChuyenMon",
            row => new TechnicianPerformance(row.Str("MaKTV")!, row.Str("HoTen")!, row.Str("ChuyenMon"), row.Long("assigned"), row.Long("completed"),
                row.Long("cancelled"), Scaled(row.DecOrNull("avgRating"), 2), Percent(row.Long("firstPass"), row.Long("completed")),
                Scaled(row.DecOrNull("avgRepairHours"), 2)),
            [.. args]);
        return rows.OrderBy(row => row.AvgRating is null).ThenByDescending(row => row.AvgRating).ThenByDescending(row => row.Completed)
            .ThenBy(row => row.EmployeeId, StringComparer.Ordinal).ToList();
    }

    /// <summary>R6 — giờ từ tiếp nhận đến bàn giao của các phiếu đã sửa xong và bàn giao.</summary>
    public async Task<Turnaround> TurnaroundAsync(DateOnly? from, DateOnly? to, string? station)
    {
        actors.Require(Permission.REPORT_OPERATIONS);
        var (where, args) = Filter("bg.NgayBanGiao", RangeOf(from, to, station));
        var durations = await sql.QueryAsync(
            $"SELECT lt.MaNhom, {Hours("ptn.NgayTiepNhan", "bg.NgayBanGiao")} AS SoGio FROM PhieuTiepNhan ptn JOIN PhieuBanGiao bg ON bg.MaPhieuTN = ptn.MaPhieuTN "
            + "JOIN ThietBi tb ON tb.MaThietBi = ptn.MaThietBi JOIN SanPham sp ON sp.MaSP = tb.MaSP JOIN LoaiThietBi lt ON lt.MaLoai = sp.MaLoai "
            + $"WHERE ptn.TrangThaiXuLy = 'DELIVERED'{where}",
            row => (Category: row.Str("MaNhom")!, Hours: row.Long("SoGio")), [.. args]);
        var byCategory = durations.GroupBy(item => item.Category).OrderBy(group => group.Key, StringComparer.Ordinal)
            .Select(group => new CategoryTurnaround(group.Key, group.LongCount(), Average(group.Select(item => item.Hours).ToList()))).ToList();
        var hours = durations.Select(item => item.Hours).ToList();
        return new Turnaround(hours.Count, Average(hours), hours.Count == 0 ? null : hours.Min(), hours.Count == 0 ? null : hours.Max(), byCategory);
    }

    /// <summary>R8 — tỷ lệ ca miễn phí theo phân loại của KTV, 1 chữ số thập phân; không có ca nào → null.</summary>
    public async Task<WarrantyRatio> WarrantyRatioAsync(DateOnly? from, DateOnly? to, string? station)
    {
        actors.Require(Permission.REPORT_OPERATIONS);
        var (where, args) = Filter("COALESCE(pkt.NgayCapNhat, pkt.NgayKiemTra)", RangeOf(from, to, station));
        var counts = await sql.FirstOrDefaultAsync(
            "SELECT COALESCE(SUM(CASE WHEN pkt.PhanLoaiBaoHanh = 'FREE_WARRANTY' THEN 1 ELSE 0 END), 0) AS free, "
            + "COALESCE(SUM(CASE WHEN pkt.PhanLoaiBaoHanh IN ('OUT_OF_WARRANTY', 'PARTIAL_WARRANTY') THEN 1 ELSE 0 END), 0) AS charged "
            + $"FROM PhieuKiemTra pkt JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = pkt.MaPhieuTN WHERE 1 = 1{where}",
            row => (Free: row.Long("free"), Charged: row.Long("charged")), [.. args]);
        return new WarrantyRatio(counts.Free, counts.Charged, Percent(counts.Free, counts.Free + counts.Charged));
    }

    /// <summary>R9 — phiếu có ít nhất một lần QC "Chưa đạt".</summary>
    public Task<List<RepeatRepair>> RepeatRepairsAsync(DateOnly? from, DateOnly? to, string? station)
    {
        actors.Require(Permission.REPORT_OPERATIONS);
        var (where, args) = Filter("ptn.NgayTiepNhan", RangeOf(from, to, station));
        return sql.QueryAsync(
            "SELECT sc.MaPhieuTN, sc.MaPhieuSC, sc.MaKTV, nv.HoTen, COUNT(*) AS attempts, SUM(CASE WHEN kq.KetQuaKCS = 'FAIL' THEN 1 ELSE 0 END) AS failedQc, "
            + "MAX(kq.NgayGhiNhan) AS lastRecordedAt FROM KetQuaSuaChua kq JOIN PhieuSuaChua sc ON sc.MaPhieuSC = kq.MaPhieuSC "
            + $"JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = sc.MaPhieuTN LEFT JOIN NhanVien nv ON nv.MaNV = sc.MaKTV WHERE 1 = 1{where} "
            + "GROUP BY sc.MaPhieuTN, sc.MaPhieuSC, sc.MaKTV, nv.HoTen HAVING SUM(CASE WHEN kq.KetQuaKCS = 'FAIL' THEN 1 ELSE 0 END) > 0 "
            + "ORDER BY failedQc DESC, sc.MaPhieuTN",
            row => new RepeatRepair(row.Str("MaPhieuTN")!, row.Str("MaPhieuSC")!, row.Str("MaKTV")!, row.Str("HoTen"), row.Long("attempts"),
                row.Long("failedQc"), row.Time("lastRecordedAt")),
            [.. args]);
    }

    /// <summary>R10 — tính lại tổng từ chi tiết; rỗng nghĩa là mọi báo giá đều khớp.</summary>
    public async Task<List<QuotationMismatch>> QuotationReconciliationAsync()
    {
        actors.Require(Permission.REPORT_SYSTEM);
        var rows = await sql.QueryAsync(
            "SELECT bg.MaBaoGia, bg.ThueVAT, bg.TongTienLinhKien, bg.TongTienCong, bg.TongTienThanhToan, COALESCE(SUM(ct.SoLuong * ct.DonGia), 0) AS partsFromLines, "
            + "COALESCE(SUM(ct.TienCongSuaChua), 0) AS laborFromLines FROM PhieuBaoGia bg LEFT JOIN ChiTietBaoGia ct ON ct.MaBaoGia = bg.MaBaoGia "
            + "GROUP BY bg.MaBaoGia, bg.ThueVAT, bg.TongTienLinhKien, bg.TongTienCong, bg.TongTienThanhToan",
            row =>
            {
                var parts = SqlMoney.Read(row.Dec("partsFromLines"));
                var labor = SqlMoney.Read(row.Dec("laborFromLines"));
                return new QuotationMismatch(row.Str("MaBaoGia")!, SqlMoney.Read(row.Dec("TongTienLinhKien")), SqlMoney.Read(row.Dec("TongTienCong")),
                    SqlMoney.Read(row.Dec("TongTienThanhToan")), parts, labor, Money.Round((parts + labor) * (1 + row.Dec("ThueVAT") / 100)));
            });
        return rows.Where(row => row.PartsTotal != row.PartsFromLines || row.LaborTotal != row.LaborFromLines || row.GrandTotal != row.ExpectedGrandTotal).ToList();
    }

    /// <summary>R11 — số phiếu theo trạng thái, theo thứ tự của máy trạng thái.</summary>
    public async Task<List<StatusCount>> TicketsByStatusAsync(DateOnly? from, DateOnly? to, string? station)
    {
        actors.Require(Permission.REPORT_OPERATIONS);
        var (where, args) = Filter("ptn.NgayTiepNhan", RangeOf(from, to, station));
        var rows = await sql.QueryAsync($"SELECT ptn.TrangThaiXuLy, COUNT(*) AS SoPhieu FROM PhieuTiepNhan ptn WHERE 1 = 1{where} GROUP BY ptn.TrangThaiXuLy",
            row => new StatusCount(row.Str("TrangThaiXuLy")!, row.Long("SoPhieu")), [.. args]);
        return rows.OrderBy(row => Enum.Parse<TicketStatus>(row.Status)).ToList();
    }

    /// <summary>R12 — phân bổ SLA của phiếu đang xử lý (trừ "Hoàn thành" và "Đã hủy").</summary>
    public Task<List<SlaBucket>> SlaDistributionAsync()
    {
        actors.Require(Permission.REPORT_OPERATIONS);
        var now = clock.GetUtcNow();
        var until = now + configuration.GetValue("Sla:AtRiskThreshold", TimeSpan.FromHours(2));
        return sql.QueryAsync(
            "SELECT MucSLA, SUM(CASE WHEN HanSLA < ? THEN 1 ELSE 0 END) AS breached, SUM(CASE WHEN HanSLA BETWEEN ? AND ? THEN 1 ELSE 0 END) AS atRisk, "
            + "COUNT(*) AS total FROM PhieuTiepNhan WHERE ConMo = 1 AND TrangThaiXuLy NOT IN ('COMPLETED', 'AWAITING_RETURN') GROUP BY MucSLA ORDER BY MucSLA",
            row => new SlaBucket(row.Str("MucSLA")!, row.Long("breached"), row.Long("atRisk"), row.Long("total") - row.Long("breached") - row.Long("atRisk")),
            now, now, until);
    }

    private static Range RangeOf(DateOnly? from, DateOnly? to, string? station)
    {
        if (from is { } f && to is { } t && t < f) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return new Range(
            from is null ? null : new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), DbTime.Offset),
            to is null ? null : new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DbTime.Offset),
            string.IsNullOrWhiteSpace(station) ? null : station);
    }

    /// <summary>Khoảng [from, to) trên cột thời gian và trạm của phiếu; null = không giới hạn phía đó.</summary>
    private static (string Sql, List<object?> Args) Filter(string column, Range range)
    {
        var where = "";
        var args = new List<object?>();
        if (range.From is { } from)
        {
            where += $" AND {column} >= ?";
            args.Add(from);
        }
        if (range.To is { } to)
        {
            where += $" AND {column} < ?";
            args.Add(to);
        }
        if (range.Station is { } station)
        {
            where += " AND ptn.MaTram = ?";
            args.Add(station);
        }
        return (where, args);
    }

    private static string Hours(string from, string to) => $"DATEDIFF(SECOND, {from}, {to}) / 3600";

    /// <summary>Như BigDecimal.setScale(scale, HALF_UP): luôn đủ số chữ số thập phân (4.50).</summary>
    private static decimal? Scaled(decimal? value, int scale) =>
        value is null ? null : Math.Round(value.Value, scale, MidpointRounding.AwayFromZero) + (scale == 2 ? 0.00m : 0.0m);

    private static decimal? Average(List<long> values) => values.Count == 0 ? null : Scaled((decimal)values.Average(), 2);

    private static decimal? Percent(long part, long total) =>
        total == 0 ? null : Math.Round(part * 100m / total, 1, MidpointRounding.AwayFromZero) + 0.0m;
}
