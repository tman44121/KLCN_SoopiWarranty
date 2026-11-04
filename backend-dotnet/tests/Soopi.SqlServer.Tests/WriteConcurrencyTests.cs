using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Soopi.Api.Data;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Services.Billing;
using Soopi.Api.Services.Catalog;
using Soopi.Api.Services.Identity;
using Soopi.Api.Services.Inventory;

namespace Soopi.SqlServer.Tests;

public sealed class WriteConcurrencyTests : IAsyncLifetime
{
    private readonly SqlFixture fixture = new();
    public Task InitializeAsync() => fixture.InitializeAsync();
    public Task DisposeAsync() => fixture.DisposeAsync();

    [Fact]
    public async Task RefreshRace_RotatesOnce_ThenCommitsFamilyRevocation()
    {
        var raw = Guid.NewGuid().ToString();
        var family = Guid.NewGuid().ToString();
        await WithSql(sql => sql.ExecuteAsync("INSERT RefreshToken (TokenHash,MaTaiKhoan,HoToken,NgayCap,HetHan) VALUES (?,?,?,?,?)",
            AuthService.Hash(raw), fixture.AccountId, family, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(1)));

        var failures = await Race(sp => sp.GetRequiredService<AuthService>().RefreshAsync(raw, null, "integration"));

        AssertOneWinner(failures, ErrorCode.AUTH_REFRESH_REUSED);
        await WithSql(async sql =>
        {
            Assert.Equal(2L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM RefreshToken WHERE HoToken=?", family)));
            Assert.Equal(0L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM RefreshToken WHERE HoToken=? AND ThuHoiLuc IS NULL", family)));
            Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaNguoiThaoTac=? AND HanhDong='AUTH_REFRESH_REUSE_DETECTED'", fixture.AccountId.ToString())));
        });
    }

    [Fact]
    public async Task ApprovalRace_IssuesEachLineOnce_AndStartsRepairOnce()
    {
        var failures = await Race(sp => sp.GetRequiredService<StockIssueService>().ApproveAsync(fixture.Id, new Dictionary<string, string>()));

        AssertOneWinner(failures, ErrorCode.STOCK_ISSUE_NOT_PENDING);
        await WithSql(async sql =>
        {
            await AssertStock(sql, 8, 0);
            Assert.Equal("ISSUED", await sql.ScalarAsync("SELECT TrangThai FROM PhieuXuatKho WHERE MaPhieuXuat=?", fixture.Id));
            Assert.Equal("REPAIRING", await sql.ScalarAsync("SELECT TrangThaiXuLy FROM PhieuTiepNhan WHERE MaPhieuTN=?", fixture.Id));
            Assert.Equal("IN_PROGRESS", await sql.ScalarAsync("SELECT TrangThaiSuaChua FROM PhieuSuaChua WHERE MaPhieuTN=?", fixture.Id));
            Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM LichSuTrangThai_ThietBi WHERE MaPhieuTN=?", fixture.Id)));
            Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaNguoiThaoTac=? AND HanhDong='STOCK_ISSUE_APPROVED'", fixture.Id)));
        });
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PaymentRace_CreatesOneReceiptWithTheServerAmount(bool charged)
    {
        await PreparePayment(charged);

        var failures = await Race(sp => Pay(sp, charged));

        AssertOneWinner(failures, ErrorCode.PAYMENT_ALREADY_EXISTS);
        await WithSql(async sql =>
        {
            Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM HoaDon_PhieuThu WHERE MaPhieuTN=?", fixture.Id)));
            Assert.Equal(charged ? 108m : 0m, Convert.ToDecimal(await sql.ScalarAsync("SELECT SoTienThu FROM HoaDon_PhieuThu WHERE MaPhieuTN=?", fixture.Id)));
            Assert.Equal(1L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaNguoiThaoTac=?", fixture.Id)));
        });
    }

    [Fact]
    public async Task ApprovalWithInsufficientSecondBin_RollsBackTheFirstDeduction()
    {
        using var scope = fixture.Scope();
        var failure = await Assert.ThrowsAsync<DomainException>(() => scope.ServiceProvider.GetRequiredService<StockIssueService>()
            .ApproveAsync(fixture.Id, new Dictionary<string, string> { [fixture.PartB] = "KHO-Z-99-98" }));

        Assert.Equal(ErrorCode.STOCK_BIN_INSUFFICIENT, failure.Code);
        await WithSql(async sql =>
        {
            await AssertStock(sql, 10, 2);
            Assert.Equal("PENDING", await sql.ScalarAsync("SELECT TrangThai FROM PhieuXuatKho WHERE MaPhieuXuat=?", fixture.Id));
            Assert.Equal("AWAITING_PARTS", await sql.ScalarAsync("SELECT TrangThaiXuLy FROM PhieuTiepNhan WHERE MaPhieuTN=?", fixture.Id));
            Assert.Equal("PENDING", await sql.ScalarAsync("SELECT TrangThaiSuaChua FROM PhieuSuaChua WHERE MaPhieuTN=?", fixture.Id));
            await AssertNoEffects(sql);
        });
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailureAfterPayment_RollsBackReceiptAndAudit(bool charged)
    {
        await PreparePayment(charged);
        using var scope = fixture.Scope();
        await Assert.ThrowsAsync<InvalidOperationException>(() => scope.ServiceProvider.GetRequiredService<TransactionRunner>().InTransactionAsync(async () =>
        {
            await Pay(scope.ServiceProvider, charged);
            throw new InvalidOperationException("Failure after payment and audit, before commit.");
        }));

        await WithSql(async sql =>
        {
            Assert.Equal(0L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM HoaDon_PhieuThu WHERE MaPhieuTN=?", fixture.Id)));
            await AssertNoEffects(sql);
        });
    }

    [Fact]
    public async Task PendingFreeWarrantyIssue_PreventsPartDeactivation_ThenRejectionAllowsIt()
    {
        using var scope = fixture.Scope();
        var catalog = scope.ServiceProvider.GetRequiredService<CatalogService>();
        var body = new Dictionary<string, JsonElement> { ["active"] = JsonSerializer.SerializeToElement(false) };

        var failure = await Assert.ThrowsAsync<DomainException>(() => catalog.UpdateAsync("parts", fixture.PartA, body));
        Assert.Equal(ErrorCode.VALIDATION_FAILED, failure.Code);
        await WithSql(async sql => Assert.True(Convert.ToBoolean(await sql.ScalarAsync("SELECT HoatDong FROM LinhKien WHERE MaLK=?", fixture.PartA))));

        await scope.ServiceProvider.GetRequiredService<StockIssueService>().RejectAsync(fixture.Id, "integration");
        var result = await catalog.UpdateAsync("parts", fixture.PartA, body);
        Assert.Equal(false, result["active"]);
    }

    private Task PreparePayment(bool charged) => WithSql(async sql =>
    {
        await sql.ExecuteAsync("UPDATE PhieuTiepNhan SET TrangThaiXuLy='COMPLETED' WHERE MaPhieuTN=?", fixture.Id);
        if (!charged) return;
        var now = DateTimeOffset.UtcNow;
        await sql.ExecuteAsync("INSERT PhieuKiemTra (MaPhieuKT,MaPhieuTN,MaKTV,NgayKiemTra,KetQuaKiemTraChiTiet,PhanLoaiBaoHanh) VALUES (?,?,?,?,'integration','FREE_WARRANTY')", fixture.Id, fixture.Id, fixture.Id, now);
        await sql.ExecuteAsync("INSERT PhieuBaoGia (MaBaoGia,MaPhieuTN,MaPhieuKT,MaKTVLap,NgayLapBaoGia,TongTienCong,ThueVAT,TongTienThanhToan,TrangThaiDuyetNoiBo,KhachXacNhan) VALUES (?,?,?,?,?,100,8,108,'APPROVED','ACCEPTED')", fixture.Id, fixture.Id, fixture.Id, fixture.Id, now);
        await sql.ExecuteAsync("INSERT ChiTietBaoGia (MaBaoGia,SoThuTu,NoiDungMuc,SoLuong,DonGia,TienCongSuaChua,ThanhTien) VALUES (?,1,'integration',1,0,100,100)", fixture.Id);
    });

    private Task Pay(IServiceProvider sp, bool charged) => charged
        ? sp.GetRequiredService<PaymentService>().CollectAsync(fixture.Id, new CollectPaymentRequest(PayerName: fixture.Id, Method: "CASH", ExpectedAmount: 108m, Note: null))
        : sp.GetRequiredService<PaymentService>().ConfirmFreeWarrantyAsync(fixture.Id, "integration");

    private async Task<Exception?[]> Race(Func<IServiceProvider, Task> operation)
    {
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<Exception?> Attempt()
        {
            using var scope = fixture.Scope();
            await start.Task;
            return await Record.ExceptionAsync(() => operation(scope.ServiceProvider));
        }
        var first = Attempt(); var second = Attempt();
        start.SetResult();
        return await Task.WhenAll(first, second).WaitAsync(TimeSpan.FromSeconds(45));
    }

    private static void AssertOneWinner(Exception?[] failures, ErrorCode loser)
    {
        Assert.Single(failures, failure => failure is null);
        Assert.Equal(loser, Assert.IsType<DomainException>(Assert.Single(failures, failure => failure is not null)).Code);
    }

    private async Task AssertStock(Sql sql, int onHand, int reserved)
    {
        foreach (var sku in new[] { fixture.PartA, fixture.PartB })
        {
            Assert.Equal(onHand, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLuongTon FROM LinhKien WHERE MaLK=?", sku)));
            Assert.Equal(reserved, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLuongDaGiu FROM LinhKien WHERE MaLK=?", sku)));
            Assert.Equal(onHand, Convert.ToInt32(await sql.ScalarAsync("SELECT SoLuong FROM TonKhoTheoKe WHERE MaLK=? AND MaKe=?", sku, SqlFixture.Bin)));
        }
    }

    private async Task AssertNoEffects(Sql sql)
    {
        Assert.Equal(0L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaNguoiThaoTac=?", fixture.Id)));
        Assert.Equal(0L, Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM ThongBao WHERE MaDoiTuong IN (?,?,?)", fixture.Id, fixture.PartA, fixture.PartB)));
    }

    private async Task WithSql(Func<Sql, Task> operation)
    {
        using var scope = fixture.Scope();
        await operation(scope.ServiceProvider.GetRequiredService<Sql>());
    }
}
