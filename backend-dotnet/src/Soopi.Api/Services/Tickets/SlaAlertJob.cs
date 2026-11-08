using Soopi.Api.Data;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Tickets;

/// <summary>Báo Điều phối và KTV khi sắp trễ hoặc đã quá SLA; mỗi loại chỉ gửi một lần mỗi phiếu.</summary>
public sealed class SlaAlertJob(IServiceScopeFactory scopes, TimeProvider clock, IConfiguration configuration, ILogger<SlaAlertJob> logger) : BackgroundService
{
    public const string Type = "SLA_AT_RISK";
    public const string BreachedType = "SLA_BREACHED";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Sla:Alerts:Enabled", true)) return;
        var interval = configuration.GetValue("Sla:Alerts:Interval", TimeSpan.FromMinutes(5));
        using var timer = new PeriodicTimer(interval, clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await NotifyAsync(scope.ServiceProvider.GetRequiredService<Sql>(),
                    scope.ServiceProvider.GetRequiredService<NotificationService>(),
                    scope.ServiceProvider.GetRequiredService<TransactionRunner>(),
                    scope.ServiceProvider.GetRequiredService<TimeSettingsService>());
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Không gửi được cảnh báo SLA");
            }
        }
    }

    public async Task<int> NotifyAsync(Sql sql, NotificationService notifications, TransactionRunner transactions, TimeSettingsService timeSettings)
    {
        var now = clock.GetUtcNow();
        var until = now + (await timeSettings.GetAsync()).AtRiskThreshold;
        const string active = "ConMo = 1 AND TrangThaiXuLy NOT IN ('COMPLETED', 'AWAITING_RETURN') AND HanSLA <= ?";
        var codes = await sql.QueryAsync("SELECT MaPhieuTN FROM PhieuTiepNhan WHERE " + active,
            row => row.Str("MaPhieuTN")!, until);
        var sent = 0;
        foreach (var code in codes)
        {
            if (await transactions.InTransactionAsync(async () =>
            {
                // Khóa phiếu trong lúc kiểm tra/gửi để hai tiến trình không tạo cảnh báo trùng.
                var candidates = await sql.QueryAsync($"SELECT p.HanSLA, pc.MaKTV FROM PhieuTiepNhan p{sql.LockHint} "
                    + "LEFT JOIN PhanCong pc ON pc.MaPhieuTN = p.MaPhieuTN WHERE p.MaPhieuTN = ? AND " + active,
                    row => (DueAt: row.Time("HanSLA")!.Value, TechnicianId: row.Str("MaKTV")), code, until);
                if (candidates.Count == 0) return false;
                var candidate = candidates[0];
                var breached = candidate.DueAt < now;
                var type = breached ? BreachedType : Type;
                if (await notifications.ExistsAsync(type, code)) return false;
                var message = $"Phiếu {code} {(breached ? "đã quá hạn" : "sắp trễ hẹn")} SLA.";
                await notifications.ForRoleAsync("DISPATCHER", type, message, "/dispatch#" + code, code);
                if (candidate.TechnicianId is { } technician)
                    await notifications.ForEmployeeAsync(technician, type, message, "/technician#" + code, code);
                return true;
            })) sent++;
        }
        return sent;
    }
}
