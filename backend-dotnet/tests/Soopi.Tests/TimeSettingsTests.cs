using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Quotations;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Services.Shared;

namespace Soopi.Tests;

public class TimeSettingsTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 2, 3, 0, 0, TimeSpan.Zero); // thứ Hai 10:00 giờ VN
    private static readonly AuthenticatedActor Receptionist =
        new(1, "NV-004", new HashSet<Role> { Role.RECEPTIONIST }, RolePermissions.ForRole(Role.RECEPTIONIST), "NV-004", null, "NV-004");

    private static readonly TimeSettings Custom = TimeSettings.Default with
    {
        ExpressSlaHours = 6, PrioritySlaHours = 20, StandardSlaHours = 36, AtRiskMinutes = 45, QuotationValidityHours = 24,
        OpenAt = new TimeOnly(7, 30), CloseAt = new TimeOnly(19, 0), WorkingDays = [1, 2, 3, 4, 5, 6, 7],
    };

    private static Ticket NewTicket(SlaLevel level, TimeSettings? times, DateTimeOffset? promised = null) =>
        new("TN-1", "HCM", Now, null, null, null, "KH-1", new Dictionary<string, string>(), "TB-1", new Dictionary<string, string>(), "NV-004",
            new WarrantyAtIntake("IN_WARRANTY", null, null, null, null, null), null, new Cosmetic(null, false, false, null, null, null, null, true),
            "Lỗi", promised, 0, level, Receptionist, times);

    [Fact]
    public void DefaultsMatchPreviousBehaviour_StandardSlaIs48Hours()
    {
        var d = TimeSettings.Default;
        Assert.Equal((12, 24, 48, SlaLevel.STANDARD_48H), (d.ExpressSlaHours, d.PrioritySlaHours, d.StandardSlaHours, d.DefaultSlaLevel));
        Assert.Equal(TimeSpan.FromHours(2), d.AtRiskThreshold);
        Assert.Equal(TimeSpan.FromHours(72), d.QuotationValidity);
        Assert.Equal("thứ Hai – thứ Bảy, 08:00 – 17:00", d.HoursText);
        Assert.Equal(Now.AddHours(48), NewTicket(SlaLevel.STANDARD_48H, null).Sla.DueAt);
    }

    [Theory]
    [InlineData(SlaLevel.EXPRESS_12H, 6)]
    [InlineData(SlaLevel.PRIORITY_24H, 20)]
    [InlineData(SlaLevel.STANDARD_48H, 36)]
    public void TicketDueDateUsesConfiguredHours(SlaLevel level, int hours) =>
        Assert.Equal(Now.AddHours(hours), NewTicket(level, Custom).Sla.DueAt);

    [Fact]
    public void BusinessHoursFollowConfiguredDaysAndClock()
    {
        var sunday1830 = DateTimeOffset.Parse("2026-11-08T18:30:00+07:00");
        Assert.False(BusinessHours.Contains(sunday1830));
        Assert.True(BusinessHours.Contains(sunday1830, Custom));
        Assert.False(BusinessHours.Contains(DateTimeOffset.Parse("2026-11-02T07:29:00+07:00"), Custom));
        var error = Assert.Throws<DomainException>(() => NewTicket(SlaLevel.STANDARD_48H, null, sunday1830));
        Assert.Equal(ErrorCode.APPOINTMENT_OUTSIDE_BUSINESS_HOURS, error.Code);
        Assert.Equal("thứ Hai – thứ Bảy, 08:00 – 17:00", error.Arguments[0]);
        Assert.Equal(sunday1830, NewTicket(SlaLevel.STANDARD_48H, Custom, sunday1830).PromisedReturnAt);
        Assert.Equal("thứ Hai, thứ Tư, 09:00 – 12:00",
            (Custom with { WorkingDays = [1, 3], OpenAt = new TimeOnly(9, 0), CloseAt = new TimeOnly(12, 0) }).HoursText);
    }

    [Fact]
    public void QuotationWithoutValidDateExpiresAfterConfiguredHours()
    {
        var quotation = new Quotation("BG-1", "TN-1", "PKT-1", "NV-002", Now, DateOnly.FromDateTime(Now.Date), null, null, null,
            [QuotationLine.Of(1, null, "Vệ sinh", 1, 50_000m, 0m)]);
        quotation.Approve("NV-001", null, Now);
        Assert.Equal(Now.AddHours(24), quotation.RespondBy(Custom));
        Assert.False(quotation.Expire(Now.AddHours(24).AddTicks(-1), Custom));
        Assert.True(quotation.Expire(Now.AddHours(24), Custom));
    }

    [Theory]
    [InlineData(0, 24, 48, "08:00", "17:00")]     // giờ SLA < 1
    [InlineData(30, 24, 48, "08:00", "17:00")]    // không tăng dần
    [InlineData(12, 24, 48, "17:00", "08:00")]    // mở cửa sau đóng cửa
    [InlineData(12, 24, 48, "8h", "17:00")]       // sai định dạng HH:mm
    public void InvalidValuesAreRejected(int express, int priority, int standard, string open, string close)
    {
        var body = new TimeSettingsBody(express, priority, standard, SlaLevel.STANDARD_48H, 120, 72, open, close, [1, 2, 3, 4, 5, 6]);
        Assert.Equal(ErrorCode.VALIDATION_FAILED, Assert.Throws<DomainException>(() => body.ToSettings().Validated()).Code);
    }

    [Fact]
    public void WorkingDaysMustBeNonEmptyDistinctIsoDays()
    {
        foreach (int[] days in new[] { Array.Empty<int>(), [0], [8], [1, 1] })
            Assert.Throws<DomainException>(() => (TimeSettings.Default with { WorkingDays = days }).Validated());
        Assert.Equal([1, 3, 7], (TimeSettings.Default with { WorkingDays = [7, 3, 1] }).Validated().WorkingDays);
    }

    [Fact]
    public void BodyRoundTripsClockAsHourMinute()
    {
        var body = TimeSettingsBody.From(Custom);
        Assert.Equal(("07:30", "19:00"), (body.OpenAt, body.CloseAt));
        Assert.Equal(Custom.OpenAt, body.ToSettings().OpenAt);
    }
}
