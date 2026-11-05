using System.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Files;

namespace Soopi.Tests;

public class AttachmentAuthorizationTests
{
    [Theory]
    [InlineData("customer", false, false, false)]
    [InlineData("customer", true, false, false)]
    [InlineData("technician", false, false, false)]
    [InlineData("technician", true, false, false)]
    [InlineData("portal", false, false, false)]
    [InlineData("portal", true, false, false)]
    [InlineData("customer", false, true, false)]
    [InlineData("customer", true, false, true)]
    public async Task Download_ChecksDirectAndAssignedAccessBeforeOpeningAFile(string kind, bool allowed, bool unsafeKey, bool missing)
    {
        var root = Path.Combine(AppContext.BaseDirectory, "attachment-auth-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, "private.bin");
        await File.WriteAllBytesAsync(path, [1, 2, 3]);
        if (missing) File.Delete(path);
        try
        {
            using var connection = new RecordingConnection(sql =>
            {
                var table = new DataTable();
                if (sql.Contains("PhanCong"))
                {
                    table.Columns.Add("Allowed", typeof(int));
                    if (allowed) table.Rows.Add(1);
                    return table;
                }
                foreach (var name in new[] { "TenTep", "LoaiNoiDung", "DuongDanLuuTru", "LoaiChuSoHuu", "MaChuSoHuu", "MaKH", "NguoiTaiLen" })
                    table.Columns.Add(name, typeof(string));
                table.Rows.Add("private.png", "image/png", unsafeKey ? "../escape.bin" : "private.bin", "WARRANTY_REQUEST", "YC-A", "KH-A", "PORTAL");
                return table;
            });
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
            var context = new DefaultHttpContext();
            if (kind == "portal") context.Items["soopi.portal"] = new PortalGrant(PortalScope.REQUEST, allowed ? "YC-A" : "YC-B");
            else
            {
                var role = kind == "technician" ? Role.TECHNICIAN : Role.CUSTOMER;
                context.Items["soopi.actor"] = new AuthenticatedActor(1, "fixture", new HashSet<Role> { role }, RolePermissions.ForRole(role),
                    role == Role.TECHNICIAN ? "NV-1" : null, allowed && role == Role.CUSTOMER ? "KH-A" : "KH-B", "Fixture");
            }
            var sql = new Sql(db); var transactions = new TransactionRunner(db);
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Directory"] = root }).Build();
            var service = new AttachmentService(new FileStorage(sql, TimeProvider.System, config, transactions), sql,
                new CurrentActor(new HttpContextAccessor { HttpContext = context }), transactions);
            using var locked = allowed ? null : new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.None);

            if (allowed && !missing)
            {
                var file = await service.DownloadAsync("1");
                Assert.Equal(new byte[] { 1, 2, 3 }, file.Content);
            }
            else
            {
                var error = await Assert.ThrowsAsync<DomainException>(() => service.DownloadAsync("1"));
                Assert.Equal(ErrorCode.NOT_FOUND, error.Code);
            }
        }
        finally
        {
            Assert.StartsWith(Path.GetFullPath(AppContext.BaseDirectory), Path.GetFullPath(root));
            Directory.Delete(root, recursive: true);
        }
    }
}
