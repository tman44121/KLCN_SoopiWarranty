namespace Soopi.Api.Domain.Shared;

/// <summary>Giờ làm việc theo giờ Việt Nam; ngày và giờ mở/đóng cửa lấy từ <see cref="TimeSettings"/> (mặc định T2–T7, 08:00–17:00).</summary>
public static class BusinessHours
{
    private static readonly TimeSpan Vietnam = TimeSpan.FromHours(7);

    public static bool Contains(DateTimeOffset value, TimeSettings? times = null)
    {
        times ??= TimeSettings.Default;
        var local = value.ToOffset(Vietnam);
        var time = TimeOnly.FromTimeSpan(local.TimeOfDay);
        return times.IsWorkingDay(local.DayOfWeek) && time >= times.OpenAt && time <= times.CloseAt;
    }

    public static void Require(DateTimeOffset? value, TimeSettings? times = null)
    {
        if (value is { } time && !Contains(time, times)) throw new DomainException(ErrorCode.APPOINTMENT_OUTSIDE_BUSINESS_HOURS, (times ?? TimeSettings.Default).HoursText);
    }

    public static void RequireRange(DateTimeOffset? from, DateTimeOffset? to, TimeSettings? times = null)
    {
        if (from is null && to is null) return;
        if (from is null || to is null || to < from || from.Value.ToOffset(Vietnam).Date != to.Value.ToOffset(Vietnam).Date)
            throw DomainException.Invalid("Khung giờ hẹn không hợp lệ — giờ kết thúc phải sau giờ bắt đầu và trong cùng một ngày.");
        Require(from, times);
        Require(to, times);
    }
}
