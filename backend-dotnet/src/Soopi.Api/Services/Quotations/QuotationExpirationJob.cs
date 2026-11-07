using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Quotations;

public sealed class QuotationExpirationService(
    QuotationStore quotations, TicketStore tickets, TransactionRunner transactions,
    AuditService audit, NotificationService notifications, TimeProvider clock)
{
    private static readonly AuthenticatedActor SystemActor = new(null, "system", new HashSet<Role>(), new HashSet<Permission>(), null, null, "Hệ thống");

    public Task<List<string>> DueCodesAsync() => quotations.FindExpiredPendingCodesAsync(clock.GetUtcNow());

    public Task<bool> ExpireAsync(string code) => transactions.InTransactionAsync(async () =>
    {
        // Khóa báo giá trước phiếu, cùng thứ tự với thao tác xác nhận của khách.
        var quotation = await quotations.FindAsync(code);
        var now = clock.GetUtcNow();
        if (quotation is null || !quotation.Expire(now)) return false;
        var ticket = await tickets.FindAsync(quotation.TicketId);
        if (ticket is null || ticket.Status != TicketStatus.AWAITING_CUSTOMER_CONFIRMATION || ticket.ActiveQuotationId != code)
            return false;
        ticket.ExpireQuotation(code, now, SystemActor);
        await quotations.SaveAsync(quotation);
        // TicketStore gửi thông báo chờ nhận máy tới web/app của chủ phiếu sau khi commit.
        await tickets.SaveAsync(ticket);
        await audit.RecordAsync("SYSTEM", "Hệ thống", ["SYSTEM"], "QUOTATION_EXPIRED",
            "Tự động từ chối báo giá hết hạn", "QUOTATION", code, "PENDING", "DECLINED");
        await notifications.ForRoleAsync("RECEPTIONIST", "QUOTATION_EXPIRED",
            $"Báo giá {code} hết hạn xác nhận. Phiếu {ticket.Id} chờ trả máy.", "/receptionist", ticket.Id);
        if (ticket.Assignment is { } assignment)
            await notifications.ForEmployeeAsync(assignment.TechnicianId, "QUOTATION_EXPIRED",
                $"Báo giá {code} hết hạn xác nhận. Phiếu {ticket.Id} chờ trả máy.", "/technician", ticket.Id);
        return true;
    });
}

public sealed class QuotationExpirationJob(
    IServiceScopeFactory scopes, TimeProvider clock, IConfiguration configuration, ILogger<QuotationExpirationJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Quotations:Expiration:Enabled", true)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<QuotationExpirationService>();
                foreach (var code in await service.DueCodesAsync())
                {
                    if (stoppingToken.IsCancellationRequested) return;
                    try { await service.ExpireAsync(code); }
                    catch (Exception exception) when (exception is not OperationCanceledException)
                    {
                        logger.LogWarning(exception, "Không xử lý được báo giá hết hạn {QuotationCode}", code);
                    }
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Không quét được báo giá hết hạn");
            }
        }
    }
}
