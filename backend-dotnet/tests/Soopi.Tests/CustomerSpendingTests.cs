using System.Data;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;

namespace Soopi.Tests;

public class CustomerSpendingTests
{
    [Fact]
    public async Task PaidAmounts_UseCustomerScopedReceipts_WithDecimalAmounts()
    {
        string? customer = null;
        using var connection = new RecordingConnection(command =>
        {
            var rows = new DataTable();
            rows.Columns.Add("MaPhieuTN"); rows.Columns.Add("SoTienThu", typeof(decimal));
            rows.Rows.Add("TN-1", 250000m); rows.Rows.Add("TN-2", 150000.5m);
            return rows;
        }) { Executing = command => customer = (string)command.Parameters[0].Value! };
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var paid = await new TicketStore(new Sql(db), null!).PaidAmountsByCustomerAsync("KH-1");
        Assert.Equal("KH-1", customer);
        Assert.Equal(400000.5m, paid.Values.Sum());
        Assert.Equal(0m, paid.GetValueOrDefault("TN-UNPAID"));
        var command = Assert.Single(connection.Commands);
        Assert.Contains("p.MaKH = @p0", command.Sql);
        Assert.Contains("thu.LoaiThu = 'CHARGED'", command.Sql);
        Assert.DoesNotContain("PhieuBaoGia", command.Sql);
    }
}
