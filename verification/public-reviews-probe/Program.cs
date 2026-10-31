// Development DB only. Every fixture, approval and audit entry rolls back; --apply-schema installs only the empty table.
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.Reporting;
using Soopi.Api.Services.Shared;

var config = new ConfigurationBuilder().AddUserSecrets(typeof(PublicReviewService).Assembly).AddEnvironmentVariables().Build();
await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(config.GetConnectionString("Default")).Options);
var sql = new Sql(db);
var script = File.ReadAllText("database/08_public_reviews.sql");
async Task Migrate(string source)
{
    foreach (var batch in Regex.Split(source, @"^GO\s*$", RegexOptions.Multiline))
        if (!string.IsNullOrWhiteSpace(batch)) await sql.ExecuteAsync(batch);
}
if (args.Contains("--apply-schema")) { await Migrate(script); Console.WriteLine("APPLIED public review approval table; no reviews published."); return; }
await using var rollback = await db.Database.BeginTransactionAsync();
script = script[script.IndexOf("IF OBJECT_ID")..script.LastIndexOf("COMMIT;")];
await Migrate(script); await Migrate(script);
await sql.ExecuteAsync("DELETE FROM DanhGiaCongKhai");
var codes = await sql.QueryAsync("SELECT TOP 3 bg.MaPhieuTN FROM PhieuBanGiao bg JOIN PhieuTiepNhan p ON p.MaPhieuTN=bg.MaPhieuTN WHERE p.TrangThaiXuLy IN ('DELIVERED','RETURNED_UNREPAIRED') ORDER BY bg.MaPhieuTN", r => r.Str("MaPhieuTN")!);
if (codes.Count < 3) throw new Exception("Need three handed-over tickets in development DB; no fixtures committed.");
var admin = Convert.ToInt64(await sql.ScalarAsync("SELECT TOP 1 MaTaiKhoan FROM TaiKhoan_VaiTro WHERE MaVaiTro='ADMIN' ORDER BY MaTaiKhoan"));
var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
http.HttpContext.Items["soopi.actor"] = new AuthenticatedActor(admin, "probe", new HashSet<Role> { Role.ADMIN }, RolePermissions.ForRole(Role.ADMIN), null, null, "Probe");
var actors = new CurrentActor(http);
var service = new PublicReviewService(sql, actors, new TransactionRunner(db), new AuditService(sql, TimeProvider.System), TimeProvider.System);
var reports = new ReportService(sql, actors, TimeProvider.System, config);
var date = new DateTimeOffset(2026, 10, 31, 3, 0, 0, TimeSpan.Zero);
var comment = "Tốt 🌟 <img src=x onerror=alert(1)>";
await sql.ExecuteAsync("UPDATE PhieuBanGiao SET DanhGiaHaiLong=5,NhanXetDanhGia=?,NgayDanhGia=? WHERE MaPhieuTN=?", comment, date, codes[0]);
await sql.ExecuteAsync("UPDATE PhieuBanGiao SET DanhGiaHaiLong=1,NhanXetDanhGia=N'Cần cải thiện',NgayDanhGia=? WHERE MaPhieuTN=?", date, codes[1]);
await sql.ExecuteAsync("UPDATE PhieuBanGiao SET DanhGiaHaiLong=5,NhanXetDanhGia=NULL,NgayDanhGia=NULL WHERE MaPhieuTN=?", codes[2]);
int checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; Console.WriteLine("PASS " + label); }
async Task Fails(Func<Task> call, ErrorCode code)
{
    try { await call(); throw new Exception("Expected " + code); }
    catch (DomainException error) { Check(error.Code == code, code.ToString()); }
}
var initial = await service.ListAsync();
var summary = (await sql.QueryAsync("SELECT COUNT_BIG(*) N,AVG(CAST(bg.DanhGiaHaiLong AS DECIMAL(10,2))) A FROM PhieuBanGiao bg JOIN PhieuTiepNhan p ON p.MaPhieuTN=bg.MaPhieuTN WHERE bg.NgayDanhGia IS NOT NULL AND bg.DanhGiaHaiLong BETWEEN 1 AND 5 AND p.TrangThaiXuLy IN ('DELIVERED','RETURNED_UNREPAIRED')", r => (N: r.Long("N"), A: r.DecOrNull("A")))).Single();
Check(initial.Items.Count == 0, "existing ratings are never published automatically");
Check(initial.ReviewCount == summary.N && initial.AverageRating == decimal.Round(summary.A!.Value, 1, MidpointRounding.AwayFromZero), "aggregate includes unpublished low scores and excludes legacy ratings");
await Fails(() => service.SetPublicationAsync(codes[2], true, 5, date, null), ErrorCode.VALIDATION_FAILED);
await Fails(() => service.SetPublicationAsync(codes[0], true, 4, date, comment), ErrorCode.CONCURRENT_MODIFICATION);
await service.SetPublicationAsync(codes[0], true, 5, date, comment);
var published = (await service.ListAsync()).Items.Single();
Check(Guid.TryParse(published.Id, out _) && !codes.Contains(published.Id) && published.Comment == comment && published.ReviewedOn == new DateOnly(2026, 10, 31), "public review uses opaque identity, exact Unicode comment and Vietnam date");
Check((await reports.CustomerReviewsAsync(null, null, null, null, codes[0], 0, 25)).Reviews.Items.Single().Published, "admin report reflects approval");
var audits = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE HanhDong='REVIEW_PUBLISHED'"));
await service.SetPublicationAsync(codes[0], true, 5, date, comment);
Check(Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE HanhDong='REVIEW_PUBLISHED'")) == audits, "duplicate approval does not create duplicate audit entries");
foreach (var edit in new[] { comment.ToUpperInvariant(), comment.Replace("Tốt", "Tot"), comment + " " })
{
    await sql.ExecuteAsync("UPDATE PhieuBanGiao SET NhanXetDanhGia=? WHERE MaPhieuTN=?", edit, codes[0]);
    Check((await service.ListAsync()).Items.Count == 0, "case, accents and trailing spaces require fresh approval");
    Check(!(await reports.CustomerReviewsAsync(null, null, null, null, codes[0], 0, 25)).Reviews.Items.Single().Published, "admin sees changed content as unpublished");
    await Fails(() => service.SetPublicationAsync(codes[0], true, 5, date, comment), ErrorCode.CONCURRENT_MODIFICATION);
}
await sql.ExecuteAsync("UPDATE PhieuBanGiao SET NhanXetDanhGia=?,DanhGiaHaiLong=2 WHERE MaPhieuTN=?", comment, codes[0]);
Check((await service.ListAsync()).Items.Count == 0, "rating edits revoke visibility even within the same second");
await service.SetPublicationAsync(codes[0], true, 2, date, comment);
Check((await service.ListAsync()).Items.Single().Id == published.Id, "reapproval preserves anonymous identifier");
await sql.ExecuteAsync("UPDATE PhieuBanGiao SET NgayDanhGia=? WHERE MaPhieuTN=?", date.AddSeconds(1), codes[0]);
Check((await service.ListAsync()).Items.Count == 0, "timestamp edits revoke approval");
await service.SetPublicationAsync(codes[0], true, 2, date.AddSeconds(1), comment);
await service.SetPublicationAsync(codes[0], false, null, null, null);
await service.SetPublicationAsync(codes[0], false, null, null, null);
Check((await service.ListAsync()).Items.Count == 0 && Convert.ToInt32(await sql.ScalarAsync("SELECT DanhGiaHaiLong FROM PhieuBanGiao WHERE MaPhieuTN=?", codes[0])) == 2, "hiding is idempotent and preserves original feedback");
Console.WriteLine($"PASS {checks} checks; all fixtures and publication decisions rolled back.");
await rollback.RollbackAsync();
