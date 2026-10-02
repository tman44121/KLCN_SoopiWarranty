using System.Data.Common;
using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

public sealed record StaffMember(string Code, string FullName, IReadOnlySet<string> Skills, int MaxActiveTickets, bool OnSite, string StationCode, string AccountId);

/// <summary>Nhân viên đang làm việc có tài khoản còn hoạt động và mang vai trò yêu cầu (NhanVien + TaiKhoan + TaiKhoan_VaiTro).</summary>
public sealed class StaffDirectory(Sql sql, IMemoryCache cache)
{
    private const string ActiveWithRole = "SELECT nv.MaNV, nv.HoTen, nv.KyNang, nv.SoPhieuToiDa, nv.CoMatTaiTram, nv.MaTram, nv.MaTaiKhoan FROM NhanVien nv "
        + "JOIN TaiKhoan tk ON tk.MaTaiKhoan = nv.MaTaiKhoan AND tk.TrangThai = 'ACTIVE' "
        + "JOIN TaiKhoan_VaiTro tv ON tv.MaTaiKhoan = tk.MaTaiKhoan AND tv.MaVaiTro = ? WHERE nv.TrangThaiLamViec = 'ACTIVE'";

    public async Task<StaffMember> RequireActiveWithRoleAsync(string? employeeId, Role role)
    {
        var member = employeeId is null ? null : await sql.FirstOrDefaultAsync(ActiveWithRole + " AND nv.MaNV = ?", Member, role.ToString(), employeeId);
        return member ?? throw (role == Role.TECHNICIAN
            ? new DomainException(ErrorCode.TECHNICIAN_INVALID)
            : new DomainException(ErrorCode.EMPLOYEE_ROLE_REQUIRED, role.Label()));
    }

    public Task<List<StaffMember>> ActiveTechniciansAsync() => sql.QueryAsync(ActiveWithRole + " ORDER BY nv.MaNV", Member, Role.TECHNICIAN.ToString());

    /// <summary>Họ tên nhân viên theo mã (gồm cả người đã nghỉ); cache 60 giây để không truy vấn lại cho từng phiếu.</summary>
    public async Task<IReadOnlyDictionary<string, string>> EmployeeNamesAsync() =>
        await cache.GetOrCreateAsync("staff:names", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60);
            return (IReadOnlyDictionary<string, string>)(await sql.QueryAsync("SELECT MaNV, HoTen FROM NhanVien", row => (row.Str("MaNV")!, row.Str("HoTen")!)))
                .ToDictionary(item => item.Item1, item => item.Item2);
        }) ?? new Dictionary<string, string>();

    private static StaffMember Member(DbDataReader row) =>
        new(row.Str("MaNV")!, row.Str("HoTen")!, JsonText.Strings(row.Str("KyNang")).ToHashSet(), row.Int("SoPhieuToiDa"), row.Bool("CoMatTaiTram"),
            row.Str("MaTram")!, row.Long("MaTaiKhoan").ToString());
}
