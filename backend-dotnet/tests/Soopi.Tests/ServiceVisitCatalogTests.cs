using System.Data;
using System.Reflection;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.Tickets;

namespace Soopi.Tests;

public class ServiceVisitCatalogTests
{
    [Theory]
    [InlineData("KH-FATHER", "KH-FATHER", true)]
    [InlineData("KH-FATHER", "KH-SON", false)]
    [InlineData("KH-SON", "KH-SON", true)]
    [InlineData("KH-SON", "KH-FATHER", false)]
    public void TicketAccess_RemainsScopedToEachVisitSender(string sender, string viewer, bool allowed)
    {
        var staff = new AuthenticatedActor(1, "staff", new HashSet<Role> { Role.RECEPTIONIST },
            RolePermissions.ForRole(Role.RECEPTIONIST), "NV-1", null, "Lễ tân");
        var ticket = new Ticket("TN-1", "HCM", DateTimeOffset.UtcNow, null, null, null, sender, new Dictionary<string, string>(),
            "TB-SAME-DEVICE", new Dictionary<string, string>(), "NV-1", new WarrantyAtIntake("IN_WARRANTY", null, null, null, null, null),
            null, new Cosmetic("NONE", false, false, "NONE", "COMPLETE", null, null, true), "Lỗi nguồn", null, 0,
            SlaLevel.STANDARD_48H, staff);
        var customer = new AuthenticatedActor(2, "customer", new HashSet<Role> { Role.CUSTOMER },
            RolePermissions.ForRole(Role.CUSTOMER), null, viewer, "Khách");
        var policy = typeof(PortalTicketService).GetMethod("OwnsTicket", BindingFlags.NonPublic | BindingFlags.Static)!;
        Assert.Equal(allowed, (bool)policy.Invoke(null, new object[] { customer, ticket })!);
    }

    private static DataTable ProductRows()
    {
        var rows = new DataTable();
        foreach (var name in new[] { "MaSP", "TenSP", "MaHang", "TenHang", "MaNhom", "MaLoai", "TenLoai", "LoaiDinhDanh" })
            rows.Columns.Add(name);
        rows.Columns.Add("ThoiHanBaoHanhMacDinhThang", typeof(int));
        rows.Rows.Add("SP-1", "Galaxy S24", "SAMSUNG", "Samsung", "PHONE", "SMARTPHONE", "Điện thoại", "IMEI", 12);
        return rows;
    }

    [Fact]
    public async Task PublicCatalog_OffersOnlyProductDisplayMetadata()
    {
        using var connection = new RecordingConnection(command => command.Contains("FROM SanPham sp") ? ProductRows() : new DataTable());
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var service = new PortalAccessService(sql, db, new ProductCatalog(sql), new CatalogStore(sql), null!, null!, TimeProvider.System, TestTimeSettings.Create());
        var json = JsonSerializer.SerializeToElement(await service.CatalogAsync(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var product = Assert.Single(json.GetProperty("products").EnumerateArray());
        Assert.Equal("SP-1", product.GetProperty("code").GetString());
        Assert.Equal("SMARTPHONE", product.GetProperty("deviceTypeCode").GetString());
        Assert.Equal(new[] { "brandName", "categoryCode", "code", "deviceTypeCode", "name" },
            product.EnumerateObject().Select(p => p.Name).Order().ToArray());
        var query = Assert.Single(connection.Commands, c => c.Sql.Contains("FROM SanPham sp")).Sql;
        foreach (var alias in new[] { "sp", "hs", "lt", "nt" }) Assert.Contains($"{alias}.HoatDong = 1", query);
        Assert.All(connection.Commands, c => Assert.StartsWith("SELECT", c.Sql[(c.Sql.IndexOf("\n", StringComparison.Ordinal) + 1)..]));
    }

    [Fact]
    public async Task Intake_UsesVisitSender_WithoutChangingRegisteredOwner()
    {
        using var connection = new RecordingConnection(command =>
        {
            if (command.Contains("FROM SanPham sp")) return ProductRows();
            var rows = new DataTable();
            if (command.Contains("FROM KhachHang"))
            {
                foreach (var name in new[] { "HoTen", "SDT", "Email", "DiaChi" }) rows.Columns.Add(name);
                rows.Rows.Add("Người con", "0912230011", DBNull.Value, DBNull.Value);
            }
            else if (command.Contains("FROM ThietBi"))
            {
                foreach (var name in new[] { "MaSP", "MaKH", "LoaiDinhDanh", "SoSerial_IMEI", "NhaPhanPhoi" }) rows.Columns.Add(name);
                rows.Columns.Add("NgayKichHoatBaoHanh", typeof(DateTime));
                rows.Columns.Add("NgayHetHanBaoHanh", typeof(DateTime));
                rows.Rows.Add("SP-1", "KH-FATHER", "IMEI", "PHONE-1234", DBNull.Value, DBNull.Value, DBNull.Value);
            }
            return rows;
        });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var service = new ReceptionService(null!, sql, new ProductCatalog(sql), null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, TimeProvider.System);
        var method = typeof(ReceptionService).GetMethod("IntakeAsync", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var result = await (Task<(Dictionary<string, string> Customer, Dictionary<string, string> Device, WarrantyAtIntake Warranty)>)
            method.Invoke(service, new object[] { "KH-SON", "TB-1", DateTimeOffset.UtcNow })!;
        Assert.Equal("Người con", result.Customer["fullName"]);
        Assert.Equal("0912230011", result.Customer["phone"]);
        Assert.Equal("PHONE-1234", result.Device["serialOrImei"]);
        Assert.All(connection.Commands, c => Assert.StartsWith("SELECT", c.Sql[(c.Sql.IndexOf("\n", StringComparison.Ordinal) + 1)..]));
    }
}
