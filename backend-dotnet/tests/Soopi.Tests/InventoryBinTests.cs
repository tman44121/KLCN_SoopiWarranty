using System.Data;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;

namespace Soopi.Tests;

public class InventoryBinTests
{
    [Fact]
    public async Task ListParts_AttachesOnlyMatchingBinsInDatabaseOrder_AndKeepsEmptyParts()
    {
        var parts = new DataTable();
        foreach (var name in new[] { "MaLK", "TenLK", "DonViTinh", "MaNhom", "TenHang", "KeChinh", "MaNCC", "TenNCC", "SDTNhaCungCap" })
            parts.Columns.Add(name, typeof(string));
        foreach (var name in new[] { "DonGiaVon", "DonGiaDichVu" }) parts.Columns.Add(name, typeof(decimal));
        foreach (var name in new[] { "SoLuongTon", "SoLuongDaGiu", "DinhMucTonToiThieu", "ThoiHanBaoHanhThang" }) parts.Columns.Add(name, typeof(int));
        parts.Columns.Add("HoatDong", typeof(bool));
        foreach (var sku in new[] { "B", "A", "EMPTY" })
        {
            var row = parts.NewRow();
            row["MaLK"] = sku; row["TenLK"] = sku; row["KeChinh"] = "KHO-A-01-01";
            row["DonGiaVon"] = 10m; row["DonGiaDichVu"] = 20m;
            row["SoLuongTon"] = 5; row["SoLuongDaGiu"] = 1; row["DinhMucTonToiThieu"] = 0;
            row["ThoiHanBaoHanhThang"] = 3; row["HoatDong"] = true;
            parts.Rows.Add(row);
        }
        var bins = new DataTable();
        bins.Columns.Add("MaLK", typeof(string)); bins.Columns.Add("MaKe", typeof(string)); bins.Columns.Add("SoLuong", typeof(int));
        bins.Rows.Add("A", "KHO-A-01-01", 2); bins.Rows.Add("A", "KHO-A-01-02", 3); bins.Rows.Add("B", "KHO-B-01-01", 5);
        using var connection = new RecordingConnection(_ => new DataTable())
        { Reader = _ => new DataTableReader([parts, bins]) };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);

        var result = await new InventoryStore(new Sql(db)).FindPartsAsync(null, null, false);

        Assert.Equal(["B", "A", "EMPTY"], result.Select(part => part.Sku));
        Assert.Equal([new Bin("KHO-B-01-01", 5)], result[0].Bins);
        Assert.Equal([new Bin("KHO-A-01-01", 2), new Bin("KHO-A-01-02", 3)], result[1].Bins);
        Assert.Empty(result[2].Bins);
        Assert.Single(connection.Commands);
    }
}
