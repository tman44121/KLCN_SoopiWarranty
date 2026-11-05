using System.Data;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Identity;
using Soopi.Api.Services.Reporting;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Portal;

namespace Soopi.Tests;

public class SecurityRegressionTests
{
    [Fact]
    public async Task FailedLoginRetry_ReloadsTheCounterAfterTheTrackerWasCleared()
    {
        var commits = 0;
        using var connection = new RecordingConnection(sql =>
        {
            if (sql.Contains("UPDATE [")) return Table(("Result", 1));
            if (sql.Contains("[TaiKhoan_VaiTro]")) return Table(("MaTaiKhoan", 1L), ("MaVaiTro", "TECHNICIAN"), ("Parent", 1L));
            if (sql.Contains("SELECT") && sql.Contains("[MatKhauHash]")) return AccountRow(sql.Contains("[NhanVien]"));
            return Table(("Result", 1));
        }) { BeforeCommit = () => { if (++commits == 1) throw new DbUpdateConcurrencyException("retry"); } };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var account = Account.Employee("staff", "unused", [Role.TECHNICIAN], "NV-1", false);
        db.Entry(account).Property(a => a.Id).CurrentValue = 1L;
        account.RoleRows[0].AccountId = 1L;
        db.Accounts.Attach(account);
        var transactions = new TransactionRunner(db);
        var auth = new AuthService(db, new AccountStore(db), null!, null!, null!, null!, new AuditService(new Sql(db), TimeProvider.System),
            Options.Create(new SecurityOptions()), null!, transactions, TimeProvider.System, null!);
        var method = typeof(AuthService).GetMethod("FailedLoginAsync", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;

        var error = await Assert.ThrowsAsync<DomainException>(async () => await (Task)method.Invoke(auth, [account, "staff", "staff"])!);

        Assert.Equal(ErrorCode.AUTH_INVALID_CREDENTIALS, error.Code);
        Assert.Equal(4, Assert.Single(error.Arguments));
        Assert.Equal(2, connection.Commands.Count(c => c.Sql.Contains("UPDATE [TaiKhoan]")));
        Assert.Equal(["rollback", "commit"], connection.Transactions);
    }

    private static DataTable Table(params (string Name, object? Value)[] values)
    {
        var table = new DataTable();
        foreach (var (name, value) in values) table.Columns.Add(name, value?.GetType() ?? typeof(string));
        table.Rows.Add(values.Select(pair => pair.Value ?? DBNull.Value).ToArray());
        return table;
    }

    private static CurrentActor Actors(Role role) => new(new HttpContextAccessor { HttpContext = new DefaultHttpContext
    {
        Items = { ["soopi.actor"] = new AuthenticatedActor(99, "admin", new HashSet<Role> { role }, RolePermissions.ForRole(role), "NV-ROOT", "KH-1", "Root") },
    } });

    private static DataTable AccountRow(bool profile = true)
    {
        (string, object?)[] columns = [("MaTaiKhoan", 1L), ("SoLanSaiLienTiep", 0), ("LanDangNhapCuoi", null),
            ("BatBuocDoiMatKhau", false), ("NgayDoiMatKhau", null), ("MatKhauHash", "unused"), ("LoaiChuThe", "EMPLOYEE"),
            ("PhienBanBaoMat", 1), ("TrangThai", "ACTIVE"), ("KhoaTamDen", null), ("TenDangNhap", "staff")];
        return Table(profile ? [.. columns, ("EmployeeId", "NV-1"), ("CustomerId", null)] : columns);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AccountLink_ChecksEmailUnderTransactionLock(bool duplicate)
    {
        using var connection = new RecordingConnection(_ => duplicate ? Table(("MaKH", "KH-OTHER")) : new DataTable());
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var profiles = new CustomerProfileStore(new Sql(db));
        var transactions = new TransactionRunner(db);
        Task Link() => transactions.InTransactionAsync(() => profiles.LinkAccountAsync("KH-1", 1, " First@Example.com "));
        if (duplicate)
        {
            var error = await Assert.ThrowsAsync<DomainException>(Link);
            Assert.Equal(ErrorCode.CUSTOMER_EMAIL_DUPLICATE, error.Code);
            Assert.DoesNotContain(connection.Commands, c => c.Sql.Contains("UPDATE KhachHang"));
        }
        else await Link();
        Assert.Contains(connection.Commands, c => c.Sql.Contains("UPDLOCK, HOLDLOCK") && c.InTransaction);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ContactUpdate_RejectsAnEmailOwnedByAnotherAccount(bool portal)
    {
        using var connection = new RecordingConnection(sql => sql.Contains("UPDATE [") ? Table(("Result", 1)) : sql.Contains("[KhachHang]")
            ? Table(("MaKH", "KH-1"), ("MaTaiKhoan", 1L), ("DiaChi", null), ("NgayTao", DateTime.Now), ("Email", "old@example.com"),
                ("HoTen", "Khách"), ("GopVaoMaKH", null), ("SDT", "0901234567"), ("TrangThai", "ACTIVE"))
            : Table(("MaKH", "KH-2")));
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var transactions = new TransactionRunner(db);
        var actors = Actors(portal ? Role.CUSTOMER : Role.RECEPTIONIST);
        var error = await Assert.ThrowsAsync<DomainException>(async () =>
        {
            if (portal)
                await new PortalProfileService(db, new PortalPolicy(db, actors), null!, transactions, null!, actors, new CustomerProfileStore(sql))
                    .UpdateContactAsync(new ProfileUpdate("shared@example.com", null));
            else
                await new CustomerService(db, sql, null!, actors, null!, TimeProvider.System, transactions, null!, null!, new CustomerProfileStore(sql))
                    .UpdateContactAsync("KH-1", new UpdateContactRequest(null, "shared@example.com", null));
        });
        Assert.Equal(ErrorCode.CUSTOMER_EMAIL_DUPLICATE, error.Code);
        Assert.DoesNotContain(connection.Commands, command => command.Sql.Contains("UPDATE [KhachHang]"));
    }

    [Fact]
    public async Task InactiveEmployee_RevokesTokensAndEvictsSecurityCache()
    {
        using var connection = new RecordingConnection(sql =>
        {
            if (sql.Contains("[TaiKhoan_VaiTro]")) return Table(("MaTaiKhoan", 1L), ("MaVaiTro", "TECHNICIAN"), ("Parent", 1L));
            if (sql.Contains("SELECT a.*")) return AccountRow();
            if (sql.Contains("FROM NhanVien")) return Table(("MaNV", "NV-1"), ("HoTen", "Staff"), ("SDT", "0901234567"), ("Email", null),
                ("ChuyenMon", null), ("KyNang", "[]"), ("SoPhieuToiDa", 10), ("CoMatTaiTram", true), ("TrangThaiLamViec", "ACTIVE"),
                ("MaTram", "HCM"), ("MaTaiKhoan", 1L));
            return Table(("Result", 1));
        });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        cache.Set("security-version:1", new SecuritySnapshot(1, "ACTIVE", true, false));
        var sql = new Sql(db); var accounts = new AccountStore(db); var transactions = new TransactionRunner(db);
        var service = new EmployeeAdminService(db, new EmployeeRecordStore(sql), accounts, new AccountPolicy(accounts),
            new SecurityVersionCache(cache, null!), null!, Actors(Role.ADMIN), transactions, new AuditService(sql, TimeProvider.System),
            Options.Create(new SecurityOptions()), TimeProvider.System);
        var command = System.Text.Json.JsonSerializer.Deserialize<Soopi.Api.DTOs.Identity.EmployeeUpdateRequest>("{\"workStatus\":\"INACTIVE\"}",
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        var result = await service.UpdateAsync("NV-1", command);
        Assert.Equal("INACTIVE", result.WorkStatus);
        Assert.Equal(2, db.Accounts.Local.Single().SecurityVersion);
        Assert.False(cache.TryGetValue("security-version:1", out _));
        Assert.Contains(connection.Commands, c => c.Sql.Contains("UPDATE") && c.Sql.Contains("[RefreshToken]") && c.InTransaction);
        Assert.Equal(["commit"], connection.Transactions);
    }
    [Fact]
    public void AccountUpdates_CompareOriginalSecurityVersion()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=unused;Database=unused").Options);
        Assert.True(db.Model.FindEntityType(typeof(Account))!.FindProperty(nameof(Account.SecurityVersion))!.IsConcurrencyToken);
    }

    [Fact]
    public async Task StaleAccountWrite_ProducesConcurrencyError()
    {
        using var connection = new RecordingConnection(_ => { var table = new DataTable(); table.Columns.Add("Result", typeof(int)); return table; });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var account = Account.Employee("staff", "old-password", [Role.TECHNICIAN], "NV-1", false);
        db.Entry(account).State = EntityState.Unchanged;
        account.ChangePassword("new-password", DateTimeOffset.UtcNow);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => db.SaveChangesAsync());
        var update = Assert.Single(connection.Commands, c => c.Sql.Contains("UPDATE [TaiKhoan]")).Sql;
        Assert.Contains("[PhienBanBaoMat]", update[update.IndexOf("WHERE", StringComparison.Ordinal)..]);
    }

    [Fact]
    public void CustomerEmail_IsNormalizedOnCreateAndUpdate()
    {
        var customer = new Customer("KH-1", "Khách", "0901234567", " First@Example.com ", null, DateTimeOffset.UtcNow);
        Assert.Equal("first@example.com", customer.Email);
        customer.UpdateContact(null, " NEXT@Example.com ", null);
        Assert.Equal("next@example.com", customer.Email);
    }

    [Fact]
    public async Task Recovery_RefusesAmbiguousEmailInsteadOfSelectingFirstAccount()
    {
        using var connection = new RecordingConnection(_ =>
        {
            var table = new DataTable();
            table.Columns.Add("MaKH", typeof(string)); table.Columns.Add("HoTen", typeof(string)); table.Columns.Add("MaTaiKhoan", typeof(long));
            table.Rows.Add("KH-1", "Một", 1L); table.Rows.Add("KH-2", "Hai", 2L);
            return table;
        });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var profiles = new CustomerProfileStore(new Sql(db));
        var error = await Assert.ThrowsAsync<DomainException>(() => profiles.FindActiveWithAccountByEmailAsync("shared@example.com"));
        Assert.Equal(ErrorCode.CUSTOMER_EMAIL_DUPLICATE, error.Code);
    }

    private static DataTable TokenRow(string sql, DateTimeOffset now, bool revoked, bool expired)
    {
        var values = new Dictionary<string, object?>
        {
            ["MaToken"] = 1L, ["MaTaiKhoan"] = 1L, ["TokenHash"] = AuthService.Hash("old-token"),
            ["HoToken"] = Guid.Empty.ToString(), ["NgayCap"] = DbTime.Local(now.AddHours(-1)), ["HetHan"] = DbTime.Local(now.AddHours(expired ? -1 : 1)),
            ["ThuHoiLuc"] = revoked ? DbTime.Local(now.AddMinutes(-1)) : null, ["ThayBangHash"] = null, ["GhiNho"] = false, ["DiaChiIP"] = "", ["UserAgent"] = "",
        };
        var select = sql[..sql.IndexOf("FROM", StringComparison.Ordinal)];
        var columns = Regex.Matches(select, @"\[\w+\]\.\[(\w+)\]").Select(m => m.Groups[1].Value).ToArray();
        return Table(columns.Select(name => (name, values[name])).ToArray());
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(false, false)]
    public async Task Refresh_LocksAccountAndCommitsRotationOrReuseRevocation(bool revoked, bool expired)
    {
        var now = DateTimeOffset.UtcNow;
        using var connection = new RecordingConnection(sql =>
        {
            if (sql.Contains("SELECT") && sql.Contains("[RefreshToken]")) return TokenRow(sql, now, revoked, expired);
            if (sql.Contains("INSERT INTO [RefreshToken]")) return Table(("MaToken", 2L));
            if (sql.Contains("[TaiKhoan_VaiTro]")) return Table(("MaTaiKhoan", 1L), ("MaVaiTro", "TECHNICIAN"), ("Parent", 1L));
            if (sql.Contains("SELECT") && sql.Contains("[MatKhauHash]")) return AccountRow(sql.Contains("[NhanVien]"));
            if (sql.Contains("FROM NhanVien")) return Table(("HoTen", "Staff"), ("TrangThai", "ACTIVE"));
            return Table(("Result", 1));
        });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var transactions = new TransactionRunner(db);
        using var host = new HostBuilder().UseEnvironment("Development").Build();
        var options = Options.Create(new SecurityOptions());
        var jwt = new JwtService(new JwtKeys(options, host.Services.GetRequiredService<IHostEnvironment>()), options, TimeProvider.System);
        var auth = new AuthService(db, new AccountStore(db), new PrincipalDirectory(sql), jwt, null!, null!, new AuditService(sql, TimeProvider.System),
            options, null!, transactions, TimeProvider.System,
            new AccessTrackingService(sql, null!, transactions, TimeProvider.System));
        if (revoked || expired)
        {
            var error = await Assert.ThrowsAsync<DomainException>(() => auth.RefreshAsync("old-token", null, null));
            Assert.Equal(revoked ? ErrorCode.AUTH_REFRESH_REUSED : ErrorCode.AUTH_TOKEN_INVALID, error.Code);
            Assert.DoesNotContain(connection.Commands, c => c.Sql.Contains("INSERT INTO [RefreshToken]"));
        }
        else
        {
            var result = await auth.RefreshAsync("old-token", null, null);
            Assert.NotEqual("old-token", result.RefreshToken);
            var original = db.RefreshTokens.Local.Single(t => t.Id == 1);
            Assert.NotNull(original.RevokedAt);
            Assert.Equal(AuthService.Hash(result.RefreshToken), original.ReplacedByHash);
        }
        var lockIndex = connection.Commands.FindIndex(c => c.Sql.Contains("TaiKhoan") && c.Sql.Contains("UPDLOCK"));
        var tokenIndex = connection.Commands.FindIndex(c => c.Sql.Contains("[ThuHoiLuc]") && c.Sql.Contains("SELECT"));
        Assert.True(lockIndex >= 0 && lockIndex < tokenIndex);
        Assert.All(connection.Commands, command => Assert.True(command.InTransaction, command.Sql));
        Assert.Equal([expired ? "rollback" : "commit"], connection.Transactions);
    }
}
