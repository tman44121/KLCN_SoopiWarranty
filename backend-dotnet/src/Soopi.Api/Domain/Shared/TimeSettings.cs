using Soopi.Api.Domain.Tickets;

namespace Soopi.Api.Domain.Shared;

/// <summary>
/// Các mốc thời gian quản trị chỉnh được (bảng CauHinhThoiGian). Ngày làm việc theo ISO: 1 = thứ Hai … 7 = Chủ nhật.
/// Đổi số giờ SLA chỉ áp cho phiếu mới (HanSLA đã lưu); hạn báo giá không ghi ngày hiệu lực tính lại theo giá trị hiện hành.
/// </summary>
public sealed record TimeSettings(
    int ExpressSlaHours,
    int PrioritySlaHours,
    int StandardSlaHours,
    SlaLevel DefaultSlaLevel,
    int AtRiskMinutes,
    int QuotationValidityHours,
    TimeOnly OpenAt,
    TimeOnly CloseAt,
    IReadOnlyList<int> WorkingDays)
{
    public static readonly TimeSettings Default = new(12, 24, 48, SlaLevel.STANDARD_48H, 120, 72,
        new TimeOnly(8, 0), new TimeOnly(17, 0), [1, 2, 3, 4, 5, 6]);

    private static readonly string[] DayNames = ["", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy", "Chủ nhật"];

    public int SlaHours(SlaLevel level) => level switch
    {
        SlaLevel.EXPRESS_12H => ExpressSlaHours,
        SlaLevel.PRIORITY_24H => PrioritySlaHours,
        _ => StandardSlaHours,
    };

    public TimeSpan AtRiskThreshold => TimeSpan.FromMinutes(AtRiskMinutes);

    public TimeSpan QuotationValidity => TimeSpan.FromHours(QuotationValidityHours);

    public bool IsWorkingDay(DayOfWeek day) => WorkingDays.Contains(day == DayOfWeek.Sunday ? 7 : (int)day);

    /// <summary>VD "thứ Hai – thứ Bảy, 08:00 – 17:00" (ngày liên tục) hoặc "thứ Hai, thứ Tư, 08:00 – 17:00".</summary>
    public string HoursText
    {
        get
        {
            var days = WorkingDays.Order().ToList();
            var contiguous = days.Count > 2 && days[^1] - days[0] == days.Count - 1;
            var dayText = contiguous ? $"{DayNames[days[0]]} – {DayNames[days[^1]]}" : string.Join(", ", days.Select(day => DayNames[day]));
            return $"{dayText}, {OpenAt:HH\\:mm} – {CloseAt:HH\\:mm}";
        }
    }

    public TimeSettings Validated()
    {
        static void Range(int value, int min, int max, string name)
        {
            if (value < min || value > max) throw DomainException.Invalid($"{name} phải từ {min} đến {max}.");
        }
        Range(ExpressSlaHours, 1, 720, "Số giờ SLA Nhanh");
        Range(PrioritySlaHours, 1, 720, "Số giờ SLA Ưu tiên");
        Range(StandardSlaHours, 1, 720, "Số giờ SLA Tiêu chuẩn");
        if (ExpressSlaHours > PrioritySlaHours || PrioritySlaHours > StandardSlaHours)
            throw DomainException.Invalid("Số giờ SLA phải tăng dần: Nhanh ≤ Ưu tiên ≤ Tiêu chuẩn.");
        if (!Enum.IsDefined(DefaultSlaLevel)) throw DomainException.Invalid("Mức SLA mặc định không hợp lệ.");
        Range(AtRiskMinutes, 1, 1440, "Ngưỡng sắp trễ (phút)");
        Range(QuotationValidityHours, 1, 720, "Hạn báo giá (giờ)");
        if (OpenAt >= CloseAt) throw DomainException.Invalid("Giờ mở cửa phải trước giờ đóng cửa.");
        if (WorkingDays.Count == 0 || WorkingDays.Any(day => day is < 1 or > 7) || WorkingDays.Distinct().Count() != WorkingDays.Count)
            throw DomainException.Invalid("Chọn ít nhất một ngày làm việc hợp lệ.");
        return this with { WorkingDays = WorkingDays.Order().ToList() };
    }
}
