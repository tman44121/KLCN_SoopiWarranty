using Soopi.Api.Domain.Shared;

namespace Soopi.Tests;

public class BusinessHoursTests
{
    [Theory]
    [InlineData("2026-11-02T01:00:00Z", true)]
    [InlineData("2026-11-02T10:00:00Z", true)]
    [InlineData("2026-11-07T10:00:00Z", true)]
    [InlineData("2026-11-08T03:00:00Z", false)]
    [InlineData("2026-11-02T00:59:00Z", false)]
    [InlineData("2026-11-02T10:01:00Z", false)]
    public void HoursAreCheckedInVietnamRegardlessOfRequestOffset(string value, bool valid)
    {
        Assert.Equal(valid, BusinessHours.Contains(DateTimeOffset.Parse(value)));
    }

    [Fact]
    public void RangeCannotCrossDaysOrClosingTime()
    {
        var start = DateTimeOffset.Parse("2026-11-02T16:30:00+07:00");
        BusinessHours.RequireRange(start, start.AddMinutes(30));
        Assert.Throws<DomainException>(() => BusinessHours.RequireRange(start, start.AddHours(1)));
        Assert.Throws<DomainException>(() => BusinessHours.RequireRange(start, start.AddDays(1)));
        Assert.Throws<DomainException>(() => BusinessHours.RequireRange(null, start));
    }
}
