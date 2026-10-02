using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Identity;

namespace Soopi.Api.Data.Stores;

/// <summary>
/// Tài khoản kèm vai trò và mã hồ sơ (NV/KH) trong một truy vấn — tương đương @Formula của entity Java. Thực thể được theo
/// dõi; thay đổi được ghi bằng SaveChanges của TransactionRunner (hoặc <see cref="SaveAsync"/> ngoài transaction).
/// </summary>
public sealed class AccountStore(AppDbContext db)
{
    /// <summary>Đăng nhập bằng tên đăng nhập (không phân biệt hoa thường nhờ collation CI) hoặc mã nhân viên.</summary>
    public Task<Account?> FindByLoginAsync(string? login)
    {
        var username = Account.Normalize(login);
        var employeeId = login is null ? "" : login.Trim().ToUpperInvariant();
        return FirstAsync(db.Accounts.Where(a =>
            a.Username == username || db.EmployeeLinks.Any(e => e.AccountId == a.Id && e.Code == employeeId)));
    }

    public Task<Account?> FindByIdAsync(long? id) =>
        id is null ? Task.FromResult<Account?>(null) : FirstAsync(db.Accounts.Where(a => a.Id == id));

    public Task<Account?> FindByEmployeeIdAsync(string employeeId) =>
        FirstAsync(db.Accounts.Where(a => db.EmployeeLinks.Any(e => e.AccountId == a.Id && e.Code == employeeId)));

    public async Task<List<Account>> FindEmployeeAccountsAsync() =>
        await LoadAsync(db.Accounts.Where(a => a.PrincipalType == PrincipalType.EMPLOYEE));

    public Task<int> CountActiveWithRoleAsync(Role role) =>
        db.Accounts.CountAsync(a => a.Status == AccountStatus.ACTIVE && a.RoleRows.Any(r => r.Role == role));

    /// <summary>Thêm tài khoản mới và ghi ngay để có MaTaiKhoan (IDENTITY), như saveAndFlush.</summary>
    public async Task<Account> AddAsync(Account account)
    {
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return account;
    }

    public Task SaveAsync() => db.SaveChangesAsync();

    private async Task<Account?> FirstAsync(IQueryable<Account> query) => (await LoadAsync(query.Take(1))).FirstOrDefault();

    private async Task<List<Account>> LoadAsync(IQueryable<Account> query)
    {
        var rows = await query
            .Select(a => new
            {
                Account = a,
                Roles = a.RoleRows.ToList(),
                EmployeeId = db.EmployeeLinks.Where(e => e.AccountId == a.Id).Select(e => e.Code).FirstOrDefault(),
                CustomerId = db.Customers.Where(c => c.AccountId == a.Id).Select(c => c.Id).FirstOrDefault(),
            })
            .AsSplitQuery()
            .ToListAsync();
        foreach (var row in rows)
        {
            row.Account.EmployeeId = row.EmployeeId;
            row.Account.CustomerId = row.CustomerId;
        }
        return rows.Select(row => row.Account).ToList();
    }
}

/// <summary>Hồ sơ gắn với tài khoản: nhân viên phải còn làm việc, khách phải còn hoạt động (không lưu trữ / đã gộp).</summary>
public sealed class PrincipalDirectory(Sql sql)
{
    public async Task<bool> ActiveAsync(Account account) => await ActiveNameAsync(account) is not null;

    public async Task<string> DisplayNameAsync(Account account) => (await PrincipalAsync(account))?.FullName ?? account.Username;

    /// <summary>Họ tên hồ sơ nếu hồ sơ còn hoạt động — một lần đọc cho cả hai kiểm tra lúc đăng nhập.</summary>
    public async Task<string?> ActiveNameAsync(Account account) =>
        await PrincipalAsync(account) is { Status: "ACTIVE" } principal ? principal.FullName : null;

    private Task<(string FullName, string Status)?> PrincipalAsync(Account account) =>
        sql.FirstOrDefaultAsync<(string, string)?>(
            account.PrincipalType == PrincipalType.EMPLOYEE
                ? "SELECT HoTen, TrangThaiLamViec AS TrangThai FROM NhanVien WHERE MaTaiKhoan = ?"
                : "SELECT HoTen, TrangThai FROM KhachHang WHERE MaTaiKhoan = ?",
            row => (row.Str("HoTen")!, row.Str("TrangThai")!),
            account.Id);
}
