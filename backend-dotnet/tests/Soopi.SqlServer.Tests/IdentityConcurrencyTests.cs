using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Http;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Files;
using Soopi.Api.Services.Identity;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.Shared;

namespace Soopi.SqlServer.Tests;

public sealed class IdentityConcurrencyTests : IAsyncLifetime
{
    private readonly SqlFixture fixture = new();
    public Task InitializeAsync() => fixture.InitializeAsync();
    public Task DisposeAsync() => fixture.DisposeAsync();

    [Fact]
    public async Task ParallelWrongLogins_CountEveryAttemptAndLockAtFive()
    {
        using var scope = fixture.Scope();
        var sql = scope.ServiceProvider.GetRequiredService<Sql>();
        await sql.ExecuteAsync("UPDATE TaiKhoan SET MatKhauHash=? WHERE MaTaiKhoan=?", PasswordHasher.Encode("Fixture!Good91"), fixture.AccountId);
        var results = await Concurrent(5, sp => sp.GetRequiredService<AuthService>().LoginAsync(fixture.Id, "wrong", false, null, null));

        Assert.Equal(4, results.Count(e => e is DomainException { Code: ErrorCode.AUTH_INVALID_CREDENTIALS }));
        Assert.Single(results, e => e is DomainException { Code: ErrorCode.AUTH_TEMPORARILY_LOCKED });
        Assert.Equal(5, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLanSaiLienTiep FROM TaiKhoan WHERE MaTaiKhoan=?", fixture.AccountId)));
        Assert.NotNull(await sql.ScalarAsync("SELECT KhoaTamDen FROM TaiKhoan WHERE MaTaiKhoan=?", fixture.AccountId));
        Assert.Equal(5L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaNguoiThaoTac=? AND HanhDong='AUTH_LOGIN_FAILED'", fixture.Id)));
        var denied = await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<AuthService>().LoginAsync(fixture.Id, "wrong", false, null, null));
        Assert.Equal(ErrorCode.RATE_LIMITED, Assert.IsType<DomainException>(denied).Code);
        var phone = (string)(await sql.ScalarAsync("SELECT SDT FROM NhanVien WHERE MaNV=?", fixture.Id))!;
        var locked = await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<AuthService>().LoginAsync(phone, "Fixture!Good91", false, null, null));
        Assert.Equal(ErrorCode.AUTH_TEMPORARILY_LOCKED, Assert.IsType<DomainException>(locked).Code);
        Assert.Equal(5, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLanSaiLienTiep FROM TaiKhoan WHERE MaTaiKhoan=?", fixture.AccountId)));
    }

    [Fact]
    public async Task SuccessfulLogin_ClearsEarlierFailuresAndIssuesASession()
    {
        using var scope = fixture.Scope();
        var sql = scope.ServiceProvider.GetRequiredService<Sql>();
        await sql.ExecuteAsync("UPDATE TaiKhoan SET MatKhauHash=?, SoLanSaiLienTiep=4 WHERE MaTaiKhoan=?",
            PasswordHasher.Encode("Fixture!Good91"), fixture.AccountId);

        var result = await scope.ServiceProvider.GetRequiredService<AuthService>().LoginAsync(fixture.Id, "Fixture!Good91", false, null, null);

        Assert.False(string.IsNullOrWhiteSpace(result.RefreshToken));
        Assert.Equal(0, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLanSaiLienTiep FROM TaiKhoan WHERE MaTaiKhoan=?", fixture.AccountId)));
        Assert.NotNull(await sql.ScalarAsync("SELECT LanDangNhapCuoi FROM TaiKhoan WHERE MaTaiKhoan=?", fixture.AccountId));
        Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM RefreshToken WHERE MaTaiKhoan=? AND ThuHoiLuc IS NULL", fixture.AccountId)));
        Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaNguoiThaoTac=? AND HanhDong='AUTH_LOGIN_SUCCESS'", fixture.Id)));
    }

    [Fact]
    public async Task ParallelWrongOtps_StopAtFive_AndRejectTheCorrectCodeAfterwards()
    {
        using var scope = fixture.Scope();
        var sql = scope.ServiceProvider.GetRequiredService<Sql>();
        var now = DateTimeOffset.UtcNow;
        await sql.ExecuteAsync("INSERT MaXacThucOTP (Email,MucDich,MaHash,NgayTao,HetHan) VALUES (?,'RESET_PASSWORD',?,?,?)",
            fixture.Id + "@example.invalid", AuthService.Hash("123456"), now, now.AddMinutes(5));

        var results = await Concurrent(12, sp => Otp(sp).VerifyAsync(fixture.Id + "@example.invalid", OtpPurpose.RESET_PASSWORD, "000000"));

        Assert.All(results, e => Assert.Equal(ErrorCode.OTP_INVALID, Assert.IsType<DomainException>(e).Code));
        Assert.Equal(5, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLanNhapSai FROM MaXacThucOTP WHERE Email=?", fixture.Id + "@example.invalid")));
        var error = await Assert.ThrowsAsync<DomainException>(() => Otp(scope.ServiceProvider)
            .ConsumeAsync(fixture.Id + "@example.invalid", OtpPurpose.RESET_PASSWORD, "123456"));
        Assert.Equal(ErrorCode.OTP_INVALID, error.Code);
        Assert.Null(await sql.ScalarAsync("SELECT DaDungLuc FROM MaXacThucOTP WHERE Email=?", fixture.Id + "@example.invalid"));
    }

    [Fact]
    public async Task ParallelCorrectOtpConsumption_HasExactlyOneWinner()
    {
        using var scope = fixture.Scope();
        var sql = scope.ServiceProvider.GetRequiredService<Sql>();
        var now = DateTimeOffset.UtcNow;
        await sql.ExecuteAsync("INSERT MaXacThucOTP (Email,MucDich,MaHash,NgayTao,HetHan) VALUES (?,'RESET_PASSWORD',?,?,?)",
            fixture.Id + "@example.invalid", AuthService.Hash("123456"), now, now.AddMinutes(5));
        var results = await Concurrent(2, sp => Otp(sp).ConsumeAsync(fixture.Id + "@example.invalid", OtpPurpose.RESET_PASSWORD, "123456"));
        Assert.Single(results, e => e is null);
        Assert.Equal(ErrorCode.OTP_INVALID, Assert.IsType<DomainException>(Assert.Single(results, e => e is not null)).Code);
    }

    [Fact]
    public async Task PhoneReuse_DoesNotTransferOwnedRequestsOrFiles_ButCustomerMergeDoes()
    {
        using var scope = fixture.Scope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDbContext>(); var sql = sp.GetRequiredService<Sql>();
        var oldPhone = (string)(await sql.ScalarAsync("SELECT SDT FROM KhachHang WHERE MaKH=?", fixture.Id))!;
        var newPhone = "09" + Random.Shared.NextInt64(10_000_000, 100_000_000);
        await sql.ExecuteAsync("UPDATE KhachHang SET SDT=? WHERE MaKH=?", newPhone, fixture.Id);
        await sql.ExecuteAsync("INSERT KhachHang (MaKH,HoTen,SDT) VALUES (?,?,?)", fixture.Id + "B", "Other customer", oldPhone);
        var requests = new WarrantyRequestStore(sql);
        var owned = "YC-" + fixture.Id; var guest = owned + "G";
        foreach (var (code, customer, serial) in new[] { (owned, (string?)fixture.Id, fixture.Id), (guest, (string?)null, fixture.Id + "G") })
            await requests.InsertAsync(new NewWarrantyRequest(code, "Original customer", oldPhone, null, null, fixture.Id, fixture.Id, "fixture",
                "SERIAL", serial, "fixture", fixture.Id, null, null, DateTimeOffset.UtcNow, customer));

        var a = Actor(fixture.Id); var b = Actor(fixture.Id + "B");
        var policyA = new PortalPolicy(db, a); var policyB = new PortalPolicy(db, b);
        var portalA = new PortalWarrantyRequestService(policyA, requests, null!, null!, a, null!);
        var portalB = new PortalWarrantyRequestService(policyB, requests, null!, null!, b, null!);
        Assert.Equal([owned], (await portalA.MineAsync()).Select(r => r.Code));
        Assert.Equal([guest], (await portalB.MineAsync()).Select(r => r.Code));
        Assert.Equal(owned, (await portalA.GetAsync(owned)).Code);
        Assert.Equal(ErrorCode.NOT_FOUND, (await Assert.ThrowsAsync<DomainException>(() => portalB.GetAsync(owned))).Code);
        Assert.Equal(guest, (await portalB.GetAsync(guest)).Code);

        var access = new PortalAccessService(sql, db, null!, null!, sp.GetRequiredService<JwtService>(),
            sp.GetRequiredService<RateLimiter>(), TimeProvider.System, sp.GetRequiredService<TimeSettingsService>());
        Assert.Equal(ErrorCode.PORTAL_NOT_FOUND, (await Assert.ThrowsAsync<DomainException>(() => access.LookupAsync(owned, oldPhone, "old-phone"))).Code);
        Assert.Equal(ErrorCode.PORTAL_NOT_FOUND, (await Assert.ThrowsAsync<DomainException>(() => access.LookupAsync(fixture.Id, oldPhone, "old-serial"))).Code);
        Assert.Equal(owned.ToUpperInvariant(), (await access.LookupAsync(owned, newPhone, "new-phone")).Code);
        Assert.Equal(guest.ToUpperInvariant(), (await access.LookupAsync(guest, oldPhone, "guest")).Code);

        var directory = Path.GetFullPath(Path.Combine("artifacts", "sql-security-files", fixture.Id));
        Directory.CreateDirectory(directory);
        try
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Directory"] = directory }).Build();
            var transactions = sp.GetRequiredService<TransactionRunner>();
            var storage = new FileStorage(sql, TimeProvider.System, config, transactions);
            var fileId = await storage.StoreAsync("fixture.png", "image/png", new byte[12], new FileOwner(AttachmentService.WarrantyRequest, owned, fixture.Id, "PORTAL"));
            var filesA = new AttachmentService(storage, sql, a, transactions); var filesB = new AttachmentService(storage, sql, b, transactions);
            Assert.Equal(fixture.Id, (await filesA.DownloadAsync(fileId)).Owner.CustomerId);
            Assert.Equal(ErrorCode.NOT_FOUND, (await Assert.ThrowsAsync<DomainException>(() => filesB.DownloadAsync(fileId))).Code);

            var customers = new CustomerService(db, sql, sp.GetRequiredService<CodeGenerator>(), sp.GetRequiredService<CurrentActor>(),
                sp.GetRequiredService<AuditService>(), TimeProvider.System, transactions, null!, null!, new CustomerProfileStore(sql));
            await customers.MergeAsync(fixture.Id, fixture.Id + "B");
            Assert.Equal(owned, (await portalB.GetAsync(owned)).Code);
            Assert.Equal(fixture.Id + "B", (await filesB.DownloadAsync(fileId)).Owner.CustomerId);
            Assert.Equal(fixture.Id + "B", await sql.ScalarAsync("SELECT MaKH FROM YeuCauBaoHanh WHERE MaYeuCau=?", owned));
            Assert.Equal(ErrorCode.NOT_FOUND, (await Assert.ThrowsAsync<DomainException>(() => portalA.GetAsync(owned))).Code);
        }
        finally
        {
            var allowed = Path.GetFullPath(Path.Combine("artifacts", "sql-security-files")) + Path.DirectorySeparatorChar;
            Assert.StartsWith(allowed, directory + Path.DirectorySeparatorChar);
            Directory.Delete(directory, recursive: true);
        }
    }

    private CurrentActor Actor(string customerId)
    {
        var context = new DefaultHttpContext();
        context.Items["soopi.actor"] = new AuthenticatedActor(fixture.AccountId, fixture.Id, new HashSet<Role> { Role.CUSTOMER },
            RolePermissions.ForRole(Role.CUSTOMER), null, customerId, customerId);
        return new CurrentActor(new LocalContext { HttpContext = context });
    }

    private static OtpService Otp(IServiceProvider sp) => new(new OtpStore(sp.GetRequiredService<Sql>(), sp.GetRequiredService<TransactionRunner>()),
        null!, null!, TimeProvider.System, new ConfigurationBuilder().Build(), NullLogger<OtpService>.Instance, sp.GetRequiredService<TransactionRunner>(), sp.GetRequiredService<TimeSettingsService>());

    private async Task<Exception?[]> Concurrent(int count, Func<IServiceProvider, Task> operation)
    {
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, count).Select(async _ =>
        {
            using var scope = fixture.Scope();
            await start.Task;
            return await Record.ExceptionAsync(() => operation(scope.ServiceProvider));
        }).ToArray();
        start.SetResult();
        return await Task.WhenAll(tasks).WaitAsync(TimeSpan.FromSeconds(60));
    }

    private sealed class LocalContext : IHttpContextAccessor { public HttpContext? HttpContext { get; set; } }
}
