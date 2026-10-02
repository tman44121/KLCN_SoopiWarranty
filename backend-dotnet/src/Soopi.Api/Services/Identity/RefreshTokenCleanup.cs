using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;

namespace Soopi.Api.Services.Identity;

/// <summary>Thay event ev_DonDepRefreshToken của bản MySQL: 02:00 giờ Việt Nam mỗi ngày xóa refresh token hết hạn quá 7 ngày.</summary>
public sealed class RefreshTokenCleanup(IServiceScopeFactory scopes, TimeProvider clock, ILogger<RefreshTokenCleanup> logger) : BackgroundService
{
    private static readonly TimeSpan KeepAfterExpiry = TimeSpan.FromDays(7);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(UntilNextRun(clock.GetUtcNow()), clock, stoppingToken);
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cutoff = clock.GetUtcNow() - KeepAfterExpiry;
                await db.RefreshTokens.Where(t => t.ExpiresAt < cutoff).ExecuteDeleteAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Không dọn được refresh token hết hạn");
            }
        }
    }

    /// <summary>Thời gian tới 02:00 giờ Việt Nam kế tiếp.</summary>
    public static TimeSpan UntilNextRun(DateTimeOffset now)
    {
        var local = now.ToOffset(DbTime.Offset);
        var next = new DateTimeOffset(local.Date.AddHours(2), DbTime.Offset);
        if (next <= local) next = next.AddDays(1);
        return next - now;
    }
}
