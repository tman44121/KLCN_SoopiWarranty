namespace Soopi.Api.Domain.Shared;

public static class BusinessHours
{
    private static readonly TimeSpan Vietnam = TimeSpan.FromHours(7);
    public static bool Contains(DateTimeOffset value)
    {
        var local = value.ToOffset(Vietnam);
        return local.DayOfWeek != DayOfWeek.Sunday && local.TimeOfDay >= TimeSpan.FromHours(8) && local.TimeOfDay <= TimeSpan.FromHours(17);
    }

    public static void Require(DateTimeOffset? value)
    {
        if (value is { } time && !Contains(time)) throw new DomainException(ErrorCode.APPOINTMENT_OUTSIDE_BUSINESS_HOURS);
    }

    public static void RequireRange(DateTimeOffset? from, DateTimeOffset? to)
    {
        if (from is null && to is null) return;
        if (from is null || to is null || to < from || from.Value.ToOffset(Vietnam).Date != to.Value.ToOffset(Vietnam).Date)
            throw DomainException.Invalid("Khung giờ hẹn không hợp lệ — giờ kết thúc phải sau giờ bắt đầu và trong cùng một ngày.");
        Require(from);
        Require(to);
    }
}
