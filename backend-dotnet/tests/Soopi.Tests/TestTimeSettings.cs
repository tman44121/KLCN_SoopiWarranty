using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Data;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Services.Shared;

namespace Soopi.Tests;

internal static class TestTimeSettings
{
    // An isolated fake connection: security tests keep their own transaction/command assertions.
    public static TimeSettingsService Create(ProtectionSettings? protection = null) =>
        CreateRaw(JsonSerializer.Serialize(protection ?? new ProtectionSettings(), JsonSetup.Create()));

    /// <summary>protectionJson = nội dung cột CauHinhBaoVe (null = cột trống).</summary>
    public static TimeSettingsService CreateRaw(string? protectionJson)
    {
        var rows = new DataTable();
        foreach (var name in new[] { "SlaNhanhGio", "SlaUuTienGio", "SlaTieuChuanGio", "NguongSapTrePhut", "HanBaoGiaGio", "PhutMoCua", "PhutDongCua" })
            rows.Columns.Add(name, typeof(int));
        rows.Columns.Add("MucSlaMacDinh"); rows.Columns.Add("NgayLamViec"); rows.Columns.Add("CauHinhBaoVe");
        rows.Rows.Add(12, 24, 48, 120, 72, 480, 1020, "STANDARD_48H", "1,2,3,4,5,6", (object?)protectionJson ?? DBNull.Value);
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(new RecordingConnection(_ => rows)).Options);
        return new TimeSettingsService(new Sql(db), new MemoryCache(new MemoryCacheOptions()), null!, null!, null!, TimeProvider.System);
    }
}
