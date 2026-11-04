using System.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.WarrantyRequests;

namespace Soopi.Tests;

public class WarrantyRequestRegressionTests
{
    [Fact]
    public async Task CancellationThatLosesToIntake_DoesNotWriteAuditOrNotifyCustomer()
    {
        using var connection = new RecordingConnection(_ =>
        {
            var table = new DataTable(); table.Columns.Add("Pending", typeof(int)); table.Rows.Add(1); return table;
        }) { NonQuery = sql => sql.Contains("UPDATE YeuCauBaoHanh") ? 0 : 1 };
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var actor = new AuthenticatedActor(1, "receptionist", new HashSet<Role> { Role.RECEPTIONIST },
            RolePermissions.ForRole(Role.RECEPTIONIST), "NV-1", null, "Lễ tân");
        var context = new DefaultHttpContext(); context.Items["soopi.actor"] = actor;
        var service = new WarrantyRequestService(new WarrantyRequestStore(sql), new CurrentActor(new HttpContextAccessor { HttpContext = context }),
            new TransactionRunner(db), new AuditService(sql, TimeProvider.System), null!, TimeProvider.System);

        var error = await Record.ExceptionAsync(() => service.CancelAsync("YC-1", "Khách hủy"));

        Assert.DoesNotContain(connection.Commands, command => command.Sql.Contains("NhatKyThaoTac") || command.Sql.Contains("ThongBao"));
        Assert.Equal(ErrorCode.WARRANTY_REQUEST_NOT_PENDING, Assert.IsType<DomainException>(error).Code);
        Assert.Equal(["rollback"], connection.Transactions);
    }
}
