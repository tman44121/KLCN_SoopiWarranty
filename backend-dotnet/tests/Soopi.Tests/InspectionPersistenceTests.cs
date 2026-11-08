using System.Data;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Services.Tickets;

namespace Soopi.Tests;

public class InspectionPersistenceTests
{
    [Fact]
    public async Task SameInstantRevision_IsSavedOnce_AndSavingANoteDoesNotReviseInspection()
    {
        var now = new DateTimeOffset(2026, 11, 4, 3, 0, 0, TimeSpan.Zero);
        var actor = new AuthenticatedActor(1, "tech", new HashSet<Role> { Role.TECHNICIAN }, RolePermissions.ForRole(Role.TECHNICIAN), "NV-1", null, "Tech");
        var ticket = new Ticket("TN-1", "HCM", now, null, null, null, "KH-1", new Dictionary<string, string>(), "TB-1",
            new Dictionary<string, string>(), "NV-2", new WarrantyAtIntake("IN_WARRANTY", null, new DateOnly(2027, 1, 1), null, null, null),
            null, new Cosmetic(null, false, false, null, null, null, null, true), "Lỗi", null, 0, SlaLevel.STANDARD_48H, actor);
        ticket.Assign("PC-1", "SC-1", "NV-2", "NV-1", null, null, now, actor);
        var original = new InspectionInput("Kết quả ban đầu", [], false, WarrantyClassification.FREE_WARRANTY, null, null, null);
        ticket.RecordInspection("KT-1", original, new DateOnly(2026, 11, 4), now, actor);
        typeof(Ticket).GetProperty(nameof(Ticket.Version))!.SetValue(ticket, 0);
        using var connection = new RecordingConnection(sql =>
        {
            var table = new DataTable();
            if (sql.Contains("FROM PhieuKiemTra"))
            {
                table.Columns.Add("NgayKiemTra", typeof(DateTime)); table.Columns.Add("NgayCapNhat", typeof(DateTime)); table.Columns.Add("SoLanSuaPhanLoai", typeof(int));
                table.Rows.Add(DbTime.Local(now), DBNull.Value, 0);
            }
            else if (sql.Contains("COUNT(*)"))
            {
                table.Columns.Add("Count", typeof(int)); table.Rows.Add(sql.Contains("LichSuTrangThai") ? ticket.StatusHistory.Count : 0);
            }
            return table;
        });
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var sql = new Sql(db);
        var store = new TicketStore(sql, new TicketProgressNotifier(sql, null!, null!, null!));
        await store.SaveAsync(ticket);
        connection.Commands.Clear();

        ticket.ReviseInspection(original with { Findings = "Kết quả đã sửa" }, new DateOnly(2026, 11, 4), now, actor);
        await store.SaveAsync(ticket);
        ticket.AddInternalNote("Ghi chú sau đó", now, actor);
        await store.SaveAsync(ticket);

        Assert.Single(connection.Commands, command => command.Sql.Contains("UPDATE PhieuKiemTra"));
    }
}
