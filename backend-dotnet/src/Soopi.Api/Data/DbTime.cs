namespace Soopi.Api.Data;

/// <summary>
/// Mọi cột DATETIME2(0) lưu giờ Việt Nam (+07:00, không đổi giờ mùa hè), không phần lẻ giây — không phụ thuộc múi giờ
/// máy chủ database. Trong code, thời điểm là DateTimeOffset UTC; ngày là DateOnly theo giờ Việt Nam.
/// </summary>
public static class DbTime
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    public static DateTime Local(DateTimeOffset value)
    {
        var local = value.ToOffset(Offset).DateTime;
        return new DateTime(local.Ticks - local.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Unspecified);
    }

    public static DateTime? Local(DateTimeOffset? value) => value is null ? null : Local(value.Value);

    public static DateTimeOffset Instant(DateTime value) => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), Offset).ToUniversalTime();

    public static DateTimeOffset? Instant(DateTime? value) => value is null ? null : Instant(value.Value);

    /// <summary>Ngày (lịch Việt Nam) của một thời điểm, như LocalDate.ofInstant(now, Asia/Ho_Chi_Minh).</summary>
    public static DateOnly Date(DateTimeOffset value) => DateOnly.FromDateTime(value.ToOffset(Offset).DateTime);
}
