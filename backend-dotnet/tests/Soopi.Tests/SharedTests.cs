using System.Text.Json;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Errors;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Services.Identity;

namespace Soopi.Tests;

public class SharedTests
{
    [Fact]
    public void Messages_FormatLikeJavaMessageFormat()
    {
        Assert.Equal("Phiếu không ở trạng thái \"Hoàn thành\".", ErrorMessages.Format(ErrorCode.TICKET_INVALID_STATE, ["Hoàn thành"]));
        // Thiếu đối số: MessageFormat giữ nguyên "{0}".
        Assert.Equal("Phiếu không ở trạng thái \"{0}\".", ErrorMessages.Format(ErrorCode.TICKET_INVALID_STATE, []));
        Assert.Equal("Không có quyền thực hiện thao tác này.", ErrorMessages.Format(ErrorCode.ACCESS_DENIED, []));
    }

    [Fact]
    public void EveryErrorCode_HasMessageAndStatus()
    {
        foreach (var code in Enum.GetValues<ErrorCode>())
        {
            Assert.NotEqual(code.ToString(), ErrorMessages.Format(code, []));
            Assert.InRange(code.Status(), 400, 599);
        }
    }

    [Theory]
    [InlineData("+84 912 345 678", "0912345678")]
    [InlineData("0912-345-678", "0912345678")]
    [InlineData(null, "")]
    public void PhoneNumber_Normalizes(string? raw, string expected) => Assert.Equal(expected, PhoneNumber.Normalize(raw));

    [Fact]
    public void PhoneNumber_RejectsInvalid()
    {
        Assert.Equal("09123456789", PhoneNumber.Require("09123456789"));
        Assert.Equal(ErrorCode.VALIDATION_FAILED, Assert.Throws<DomainException>(() => PhoneNumber.Require("12345")).Code);
    }

    [Fact]
    public void Imei_ChecksLuhn()
    {
        Assert.Equal("354812109876540", Imei.Require("3548 1210 9876 540"));
        Assert.Equal(ErrorCode.IMEI_INVALID, Assert.Throws<DomainException>(() => Imei.Require("354812109876541")).Code);
        Assert.Equal(ErrorCode.SERIAL_REQUIRED, Assert.Throws<DomainException>(() => SerialNumber.Require("ab")).Code);
        Assert.Equal("SN-ABC1", SerialNumber.Require(" sn-abc1 "));
    }

    [Fact]
    public void Money_RoundsHalfUpNotBankers()
    {
        Assert.Equal(3m, Money.Round(2.5m));
        Assert.Equal(1_000_001m, Money.Round(1_000_000.5m));
        Assert.Equal(-3m, Money.Round(-2.5m));
    }

    [Fact]
    public void CodeStems_MatchJavaFormats()
    {
        var date = new DateOnly(2026, 9, 17);
        Assert.Equal("TN-2026-0917", CodeGenerator.Stem(BusinessCodeType.Ticket, date));
        Assert.Equal("PX-2026", CodeGenerator.Stem(BusinessCodeType.StockIssue, date));
        Assert.Equal("KH", CodeGenerator.Stem(BusinessCodeType.Customer, date));
    }

    [Fact]
    public void DbTime_StoresVietnamTimeWithoutFraction()
    {
        var instant = new DateTimeOffset(2026, 9, 26, 17, 15, 0, 750, TimeSpan.Zero);
        var local = DbTime.Local(instant);
        Assert.Equal(new DateTime(2026, 9, 27, 0, 15, 0), local);
        Assert.Equal(new DateTimeOffset(2026, 9, 26, 17, 15, 0, TimeSpan.Zero), DbTime.Instant(local));
        Assert.Equal(new DateOnly(2026, 9, 27), DbTime.Date(instant));
    }

    [Fact]
    public void SqlHelpers_MatchJava()
    {
        Assert.Equal("%a[%]b[_]c[[]%", SqlLike.Contains("a%b_c["));
        Assert.Equal("150000", SqlMoney.Read(150000.00m).ToString(System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal("8.5", SqlMoney.Read(8.50m).ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public void Json_WritesInstantsAsUtcZ_AndNullBooleanAsFalse()
    {
        var options = JsonSetup.Create();
        var instant = new DateTimeOffset(2026, 9, 26, 10, 15, 0, TimeSpan.FromHours(7));
        Assert.Equal("\"2026-09-26T03:15:00Z\"", JsonSerializer.Serialize(instant, options));
        Assert.Equal("{\"flag\":false,\"status\":\"ACTIVE\"}", JsonSerializer.Serialize(new Sample(false, AccountStatus.ACTIVE), options));
        Assert.False(JsonSerializer.Deserialize<Sample>("{\"flag\":null,\"status\":\"ACTIVE\"}", options)!.Flag);
        Assert.Equal(AccountStatus.ACTIVE, JsonSerializer.Deserialize<Sample>("{\"flag\":true,\"status\":0}", options)!.Status);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Sample>("{\"flag\":true,\"status\":99}", options));
    }

    [Fact]
    public void RefreshTokenCleanup_RunsAt2amVietnam()
    {
        // 01:00 giờ VN (18:00 UTC hôm trước) → còn 1 giờ; 03:00 giờ VN → 23 giờ.
        Assert.Equal(TimeSpan.FromHours(1), RefreshTokenCleanup.UntilNextRun(new DateTimeOffset(2026, 9, 26, 18, 0, 0, TimeSpan.Zero)));
        Assert.Equal(TimeSpan.FromHours(23), RefreshTokenCleanup.UntilNextRun(new DateTimeOffset(2026, 9, 26, 20, 0, 0, TimeSpan.Zero)));
    }

    private sealed record Sample(bool Flag, AccountStatus Status);
}
