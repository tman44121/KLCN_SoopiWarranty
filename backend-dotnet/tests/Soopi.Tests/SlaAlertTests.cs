using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Soopi.Api.Data;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Tickets;

namespace Soopi.Tests;

public class SlaAlertTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(60)]
    public async Task SendsOnceForEachStage_WithoutWritingADatabase(int minutesUntilDue)
    {
        var clock = new TestClock(new DateTimeOffset(2026, 11, 7, 3, 0, 0, TimeSpan.Zero));
        var notified = false;
        var types = new List<string>();
        using var connection = new RecordingConnection(command =>
        {
            var rows = new DataTable();
            if (command.Contains("SELECT MaPhieuTN"))
            {
                rows.Columns.Add("MaPhieuTN"); rows.Rows.Add("TN-1");
            }
            else if (command.Contains("SELECT p.HanSLA"))
            {
                rows.Columns.Add("HanSLA", typeof(DateTime)); rows.Columns.Add("MaKTV");
                rows.Rows.Add(DbTime.Local(clock.Now.AddMinutes(minutesUntilDue)), DBNull.Value);
            }
            else if (command.Contains("INSERT INTO ThongBao"))
            {
                notified = true; rows.Columns.Add("id", typeof(long)); rows.Rows.Add(1L);
            }
            else if (command.Contains("FROM ThongBao") && notified)
            {
                rows.Columns.Add("found", typeof(int)); rows.Rows.Add(1);
            }
            return rows;
        }) { Executing = command =>
        {
            if (command.CommandText.Contains("INSERT INTO ThongBao"))
                types.Add((string)command.Parameters[2].Value!);
        } };
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var transactions = new TransactionRunner(db);
        var notifications = new NotificationService(sql, clock, null!, transactions);
        var job = new SlaAlertJob(null!, clock, new ConfigurationBuilder().Build(), NullLogger<SlaAlertJob>.Instance);
        var times = new TimeSettingsService(sql, new MemoryCache(new MemoryCacheOptions()), null!, null!, transactions, clock);
        Assert.Equal(1, await job.NotifyAsync(sql, notifications, transactions, times));
        Assert.Equal(0, await job.NotifyAsync(sql, notifications, transactions, times));
        Assert.Equal([minutesUntilDue < 0 ? SlaAlertJob.BreachedType : SlaAlertJob.Type], types);
        Assert.Single(connection.Commands, command => command.Sql.Contains("INSERT INTO ThongBao"));
        Assert.All(connection.Commands.Where(command => command.Sql.Contains("INSERT INTO ThongBao")), command => Assert.True(command.InTransaction));
    }

    private sealed class TestClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
