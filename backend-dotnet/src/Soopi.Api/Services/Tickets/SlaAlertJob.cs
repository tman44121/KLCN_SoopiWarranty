using Soopi.Api.Data.Stores;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Tickets;

/// <summary>
/// Mục 11.10: định kỳ (mặc định 5 phút) báo Điều phối và KTV phụ trách các phiếu sắp trễ SLA — mỗi phiếu chỉ báo một lần.
/// Tắt bằng <c>Sla:Alerts:Enabled = false</c>.
/// </summary>
public sealed class SlaAlertJob(IServiceScopeFactory scopes, TimeProvider clock, IConfiguration configuration, ILogger<SlaAlertJob> logger) : BackgroundService
{
    public const string Type = "SLA_AT_RISK";

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
                await NotifyAtRiskAsync(scope.ServiceProvider.GetRequiredService<TicketStore>(),
                    scope.ServiceProvider.GetRequiredService<NotificationService>());
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Không gửi được cảnh báo SLA");
            }
        }
    }

    public async Task<int> NotifyAtRiskAsync(TicketStore tickets, NotificationService notifications)
    {
        var now = clock.GetUtcNow();
        var sent = 0;
        foreach (var ticket in await tickets.FindSlaDueBetweenAsync(now, now + configuration.GetValue("Sla:AtRiskThreshold", TimeSpan.FromHours(2))))
        {
            if (await notifications.ExistsAsync(Type, ticket.Id)) continue;
            var message = $"Phiếu {ticket.Id} sắp trễ hẹn SLA.";
            await notifications.ForRoleAsync("DISPATCHER", Type, message, "/dispatch#" + ticket.Id, ticket.Id);
            if (ticket.Assignment is { } assignment)
                await notifications.ForEmployeeAsync(assignment.TechnicianId, Type, message, "/technician#" + ticket.Id, ticket.Id);
            sent++;
        }
        return sent;
    }
}
