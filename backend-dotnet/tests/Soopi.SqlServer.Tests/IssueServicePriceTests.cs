using Microsoft.Extensions.DependencyInjection;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Inventory;
using Soopi.Api.Services.Inventory;

namespace Soopi.SqlServer.Tests;

/// <summary>Giá trị "Miễn phí trong bảo hành" của phiếu đã xuất không đổi khi quản trị viên sửa giá danh mục.</summary>
public sealed class IssueServicePriceTests : IAsyncLifetime
{
    private readonly SqlFixture fixture = new();
    public Task InitializeAsync() => fixture.InitializeAsync();
    public Task DisposeAsync() => fixture.DisposeAsync();

    [Fact]
    public async Task FreeWarrantyValue_UsesIssueTimePrice_OldLinesFallBackToCurrentPrice()
    {
        var code = fixture.Id + "N";
        using var scope = fixture.Scope();
        var sql = scope.ServiceProvider.GetRequiredService<Sql>();
        try
        {
            var now = TimeProvider.System.GetUtcNow();
            // Mỗi phiếu chỉ một phiếu xuất đang chờ: xuất xong phiếu sẵn có của fixture trước.
            await sql.ExecuteAsync("UPDATE PhieuXuatKho SET TrangThai = 'ISSUED', MaThuKhoXuLy = ?, NgayXuLy = ? WHERE MaPhieuXuat = ?", fixture.Id, now, fixture.Id);
            // Phiếu xuất mới: lưu giá tính khách lúc lập (20 đ, giá danh mục của fixture).
            await scope.ServiceProvider.GetRequiredService<InventoryDocumentStore>().SaveAsync(new StockIssue(code, fixture.Id, "FREE_WARRANTY", null,
                "integration", fixture.Id, fixture.Id, now, [new IssueLine(fixture.PartA, 1, 10, null, null, 20)]));
            Assert.Equal(20m, Convert.ToDecimal(await sql.ScalarAsync("SELECT DonGiaDichVuXuat FROM ChiTietXuatKho WHERE MaPhieuXuat = ?", code)));
            await sql.ExecuteAsync("UPDATE PhieuXuatKho SET TrangThai = 'ISSUED', MaThuKhoXuLy = ?, NgayXuLy = ? WHERE MaPhieuXuat = ?", fixture.Id, now, code);

            // Quản trị viên sửa giá sau khi đã xuất.
            await sql.ExecuteAsync("UPDATE LinhKien SET DonGiaDichVu = 99 WHERE MaLK = ?", fixture.PartA);

            var parts = await scope.ServiceProvider.GetRequiredService<IssuedParts>().FindByTicketAsync(fixture.Id);
            Assert.Equal(20m, parts.Single(part => part.IssueCode == code).ServicePrice);
            // Dòng xuất cũ chưa lưu giá (fixture không ghi cột mới) vẫn dùng giá hiện tại như trước.
            Assert.Equal(99m, parts.Single(part => part.IssueCode == fixture.Id && part.Sku == fixture.PartA).ServicePrice);
        }
        finally
        {
            await sql.ExecuteAsync("DELETE ChiTietXuatKho WHERE MaPhieuXuat = ?; DELETE PhieuXuatKho WHERE MaPhieuXuat = ?", code, code);
        }
    }
}
