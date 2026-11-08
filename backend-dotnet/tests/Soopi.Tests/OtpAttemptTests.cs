using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Services.Identity;

namespace Soopi.Tests;

public class OtpAttemptTests
{
    private static DataTable Pending(int failures, DateTimeOffset expires)
    {
        var table = new DataTable();
        table.Columns.Add("MaOTP", typeof(long)); table.Columns.Add("MaHash", typeof(string));
        table.Columns.Add("SoLanNhapSai", typeof(int)); table.Columns.Add("HetHan", typeof(DateTime));
        table.Rows.Add(1L, AuthService.Hash("123456"), failures, DbTime.Local(expires));
        return table;
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task WrongCode_CommitsFailureBeforeReportingError(bool consume)
    {
        using var connection = new RecordingConnection(_ => Pending(0, DateTimeOffset.UtcNow.AddMinutes(5)));
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var service = Service(db);

        var error = await Assert.ThrowsAsync<DomainException>(() => Check(service, consume, "000000"));

        Assert.Equal(ErrorCode.OTP_INVALID, error.Code);
        Assert.Equal(["commit"], connection.Transactions);
        var read = Assert.Single(connection.Commands, c => c.Sql.Contains("SELECT"));
        Assert.Contains("UPDLOCK", read.Sql); Assert.Contains("HOLDLOCK", read.Sql);
        Assert.All(connection.Commands, c => Assert.True(c.InTransaction, c.Sql));
        Assert.Single(connection.Commands, c => c.Sql.Contains("SoLanNhapSai = SoLanNhapSai + 1"));
        Assert.DoesNotContain(connection.Commands, c => c.Sql.Contains("SET DaDungLuc"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ExpiryWhileWaitingForTheLock_RejectsPreviouslySelectedCode(bool consume)
    {
        using var connection = new RecordingConnection(_ => Pending(0, DateTimeOffset.UtcNow.AddSeconds(-1)));
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);

        var error = await Assert.ThrowsAsync<DomainException>(() => Check(Service(db), consume, "123456"));

        Assert.Equal(ErrorCode.OTP_INVALID, error.Code);
        Assert.DoesNotContain(connection.Commands, c => c.Sql.StartsWith("UPDATE"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CorrectCodeAtTheLimit_IsRejectedWithoutMoreWrites(bool consume)
    {
        using var connection = new RecordingConnection(_ => Pending(5, DateTimeOffset.UtcNow.AddMinutes(5)));
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var error = await Assert.ThrowsAsync<DomainException>(() => Check(Service(db), consume, "123456"));
        Assert.Equal(ErrorCode.OTP_INVALID, error.Code);
        Assert.DoesNotContain(connection.Commands, c => c.Sql.StartsWith("UPDATE"));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CorrectCode_VerifiesWithoutConsuming_OrConsumesOnce(bool consume)
    {
        using var connection = new RecordingConnection(_ => Pending(0, DateTimeOffset.UtcNow.AddMinutes(5)));
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);

        await Check(Service(db), consume, "123456");

        Assert.Equal(["commit"], connection.Transactions);
        Assert.Equal(consume ? 1 : 0, connection.Commands.Count(c => c.Sql.Contains("SET DaDungLuc")));
        Assert.DoesNotContain(connection.Commands, c => c.Sql.Contains("SoLanNhapSai = SoLanNhapSai + 1"));
    }

    private static Task Check(OtpService service, bool consume, string code) => consume
        ? service.ConsumeAsync("otp@example.invalid", OtpPurpose.RESET_PASSWORD, code)
        : service.VerifyAsync("otp@example.invalid", OtpPurpose.RESET_PASSWORD, code);

    private static OtpService Service(AppDbContext db) => new(new OtpStore(new Sql(db), new TransactionRunner(db)), null!, null!,
        TimeProvider.System, new ConfigurationBuilder().Build(), NullLogger<OtpService>.Instance, new TransactionRunner(db), TestTimeSettings.Create());
}
