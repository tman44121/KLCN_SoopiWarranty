using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Text.Json.Serialization;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Data;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Shared;

/// <summary>Body/response của /settings/time: giờ dạng "HH:mm", ngày làm việc ISO 1 = thứ Hai … 7 = Chủ nhật.</summary>
public sealed record TimeSettingsBody(
    int ExpressSlaHours, int PrioritySlaHours, int StandardSlaHours, SlaLevel DefaultSlaLevel,
    int AtRiskMinutes, int QuotationValidityHours, string OpenAt, string CloseAt, IReadOnlyList<int> WorkingDays,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ProtectionSettings? Protection = null)
{
    public static TimeSettingsBody From(TimeSettings s, bool admin = false) => new(s.ExpressSlaHours, s.PrioritySlaHours, s.StandardSlaHours, s.DefaultSlaLevel,
        s.AtRiskMinutes, s.QuotationValidityHours, s.OpenAt.ToString("HH:mm"), s.CloseAt.ToString("HH:mm"), s.WorkingDays, admin ? s.Protection : null);

    public TimeSettings ToSettings() => new(ExpressSlaHours, PrioritySlaHours, StandardSlaHours, DefaultSlaLevel, AtRiskMinutes,
        QuotationValidityHours, Clock(OpenAt, "Giờ mở cửa"), Clock(CloseAt, "Giờ đóng cửa"), WorkingDays ?? [])
        { Protection = Protection ?? new ProtectionSettings() };

    private static TimeOnly Clock(string? value, string name) =>
        TimeOnly.TryParseExact(value, "HH:mm", out var time) ? time : throw DomainException.Invalid($"{name} phải theo dạng HH:mm.");
}

/// <summary>
/// Đọc/ghi một dòng CauHinhThoiGian (Id = 1). Chưa có dòng hoặc database chưa chạy 14_time_settings.sql thì dùng
/// <see cref="TimeSettings.Default"/>. Giữ trong bộ nhớ 1 phút; lưu xong xóa cache nên tiến trình này áp dụng ngay.
/// </summary>
public sealed class TimeSettingsService(Sql sql, IMemoryCache cache, CurrentActor actors, AuditService audit, TransactionRunner transactions, TimeProvider clock,
    IOptions<SecurityOptions>? security = null)
{
    private const string CacheKey = "time-settings";

    public async Task<TimeSettings> GetAsync() =>
        await cache.GetOrCreateAsync(CacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            return LoadAsync();
        }) ?? TimeSettings.Default;

    public async Task<TimeSettings> UpdateAsync(TimeSettingsBody body)
    {
        var actor = actors.Current;
        var value = body.ToSettings().Validated();
        value.Protection.Validated();
        await transactions.InTransactionAsync(async () =>
        {
            var before = await LoadAsync();
            value = value with { Protection = body.Protection ?? before.Protection };
            var hasProtection = await sql.ScalarAsync("SELECT COL_LENGTH('dbo.CauHinhThoiGian', 'CauHinhBaoVe')") is not null;
            if (body.Protection is not null && !hasProtection)
                throw DomainException.Invalid("Cần chạy 16_protection_settings.sql trước khi lưu cấu hình bảo vệ.");
            var minutes = (TimeOnly time) => time.Hour * 60 + time.Minute;
            await sql.ExecuteAsync(
                "MERGE CauHinhThoiGian WITH (HOLDLOCK) AS t USING (SELECT 1 AS Id) AS s ON t.Id = s.Id "
                + "WHEN MATCHED THEN UPDATE SET SlaNhanhGio = ?, SlaUuTienGio = ?, SlaTieuChuanGio = ?, MucSlaMacDinh = ?, NguongSapTrePhut = ?, "
                + "HanBaoGiaGio = ?, PhutMoCua = ?, PhutDongCua = ?, NgayLamViec = ?, NguoiCapNhat = ?, NgayCapNhat = ? "
                + "WHEN NOT MATCHED THEN INSERT (Id, SlaNhanhGio, SlaUuTienGio, SlaTieuChuanGio, MucSlaMacDinh, NguongSapTrePhut, HanBaoGiaGio, "
                + "PhutMoCua, PhutDongCua, NgayLamViec, NguoiCapNhat, NgayCapNhat) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
                [.. Args(), .. Args()]);
            if (hasProtection)
                await sql.ExecuteAsync("UPDATE CauHinhThoiGian SET CauHinhBaoVe = ? WHERE Id = 1",
                    JsonSerializer.Serialize(value.Protection, JsonSetup.Create()));
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "TIME_SETTINGS_UPDATED", "Cập nhật cấu hình thời gian",
                "SETTINGS", "TIME", Summary(before), Summary(value));

            object?[] Args() => [value.ExpressSlaHours, value.PrioritySlaHours, value.StandardSlaHours, value.DefaultSlaLevel,
                value.AtRiskMinutes, value.QuotationValidityHours, minutes(value.OpenAt), minutes(value.CloseAt),
                string.Join(",", value.WorkingDays), actor.AuditId, clock.GetUtcNow()];
        });
        cache.Remove(CacheKey);
        return value;
    }

    private async Task<TimeSettings> LoadAsync() =>
        // IF OBJECT_ID: database chưa nâng cấp thì không có result set (không lỗi 208 giữa transaction đang mở).
        await sql.FirstOrDefaultAsync(
            "IF OBJECT_ID(N'dbo.CauHinhThoiGian', N'U') IS NOT NULL SELECT * FROM CauHinhThoiGian WHERE Id = 1",
            row => new TimeSettings(row.Int("SlaNhanhGio"), row.Int("SlaUuTienGio"), row.Int("SlaTieuChuanGio"),
                Enum.Parse<SlaLevel>(row.Str("MucSlaMacDinh")!), row.Int("NguongSapTrePhut"), row.Int("HanBaoGiaGio"),
                TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(row.Int("PhutMoCua"))), TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(row.Int("PhutDongCua"))),
                row.Str("NgayLamViec")!.Split(',').Select(int.Parse).ToList()) { Protection = ReadProtection(row) })
        ?? (TimeSettings.Default with { Protection = DefaultProtection() });

    /// <summary>JSON hỏng hoặc ngoài giới hạn (sửa tay trong DB) thì dùng mặc định, không để lỗi cấu hình chặn đăng nhập/OTP/tra cứu.</summary>
    private ProtectionSettings ReadProtection(System.Data.Common.DbDataReader row)
    {
        for (var i = 0; i < row.FieldCount; i++)
            if (row.GetName(i) == "CauHinhBaoVe" && !row.IsDBNull(i))
                try
                {
                    return JsonSerializer.Deserialize<ProtectionSettings>(row.GetString(i), JsonSetup.Create())?.Validated() ?? DefaultProtection();
                }
                catch (Exception e) when (e is JsonException or DomainException)
                {
                    return DefaultProtection();
                }
        return DefaultProtection();
    }

    private ProtectionSettings DefaultProtection()
    {
        var options = security?.Value ?? new SecurityOptions();
        return new ProtectionSettings
        {
            LoginMaxFailedAttempts = options.Login.MaxFailedAttempts,
            LoginLockMinutes = (int)options.Login.TemporaryLock.TotalMinutes,
            AccessTokenMinutes = (int)options.Jwt.AccessTokenTtl.TotalMinutes,
            RefreshTokenHours = (int)options.Jwt.RefreshTokenTtl.TotalHours,
            RememberTokenDays = (int)options.Jwt.RefreshTokenRememberTtl.TotalDays,
            PortalTokenMinutes = (int)options.Jwt.PortalTokenTtl.TotalMinutes,
        };
    }

    private static string Summary(TimeSettings s) =>
        $"SLA {s.ExpressSlaHours}/{s.PrioritySlaHours}/{s.StandardSlaHours}h, mặc định {s.DefaultSlaLevel}; sắp trễ {s.AtRiskMinutes} phút; "
        + $"báo giá {s.QuotationValidityHours}h; {s.HoursText}; bảo vệ {JsonSerializer.Serialize(s.Protection, JsonSetup.Create())}";
}
