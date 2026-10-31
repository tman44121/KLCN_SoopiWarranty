// Run at repository root on a local demo DB. Fixtures, audit rows and token changes always roll back.
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Identity;
using Soopi.Api.Services.Reporting;
using Soopi.Api.Services.Shared;

var config = new ConfigurationBuilder().AddUserSecrets(typeof(AccessTrackingService).Assembly).AddEnvironmentVariables().Build();
await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(config.GetConnectionString("Default")).Options);
var sql = new Sql(db);
var script = File.ReadAllText("database/07_access_statistics.sql");
async Task Migrate(string source)
{
    foreach (var batch in Regex.Split(source, @"^GO\s*$", RegexOptions.Multiline))
        if (!string.IsNullOrWhiteSpace(batch)) await sql.ExecuteAsync(batch);
}
if (args.Contains("--apply-schema")) { await Migrate(script); Console.WriteLine("APPLIED persistent access statistics tables from 31/10/2026; no visits/logins backfilled."); return; }
await using var rollback = await db.Database.BeginTransactionAsync();
script = script[script.IndexOf("IF OBJECT_ID")..script.LastIndexOf("COMMIT;")];
await Migrate(script); await Migrate(script);
var clock = new ProbeClock { Now = Local(2026, 10, 30, 23, 59) };
var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
var actors = new CurrentActor(http);
var transactions = new TransactionRunner(db);
var tracking = new AccessTrackingService(sql, actors, transactions, clock);
var stats = new AccessStatisticsService(sql, actors, tracking, clock);
var audit = new AuditService(sql, clock);
var suffix = Guid.NewGuid().ToString("N")[..10];
var username = "access-probe-" + suffix;
var customer = Convert.ToInt64(await sql.ScalarAsync("INSERT TaiKhoan (TenDangNhap,MatKhauHash,LoaiChuThe) OUTPUT INSERTED.MaTaiKhoan VALUES (?,'{bcrypt}probe','CUSTOMER')", username));
var admin = Convert.ToInt64(await sql.ScalarAsync("INSERT TaiKhoan (TenDangNhap,MatKhauHash,LoaiChuThe) OUTPUT INSERTED.MaTaiKhoan VALUES (?,'{bcrypt}probe','EMPLOYEE')", username + "-admin"));
await sql.ExecuteAsync("INSERT TaiKhoan_VaiTro VALUES (?,'CUSTOMER'),(?,'ADMIN')", customer, admin);
var customerCode = "KHAP-" + suffix; var employeeCode = "NVAP-" + suffix;
await sql.ExecuteAsync("INSERT KhachHang (MaKH,HoTen,SDT,MaTaiKhoan) VALUES (?,?,?,?)", customerCode, "=SUM(A1) <script> 🌟", Phone(), customer);
var station = await sql.ScalarAsync("SELECT TOP 1 MaTram FROM TramDichVu ORDER BY MaTram");
await sql.ExecuteAsync("INSERT NhanVien (MaNV,HoTen,SDT,MaTram,MaTaiKhoan) VALUES (?,?,?,?,?)", employeeCode, "Admin truy cập thử", Phone(), station, admin);
string Phone() => "099" + Random.Shared.Next(1000000, 9999999);
var family1 = Guid.NewGuid().ToString(); var family2 = Guid.NewGuid().ToString(); var adminFamily = Guid.NewGuid().ToString();
var raw1 = "access-probe-token-" + suffix; var raw2 = raw1 + "-two";
async Task Token(long account, string family, string raw)
{
    await sql.ExecuteAsync("INSERT RefreshToken (TokenHash,MaTaiKhoan,HoToken,NgayCap,HetHan) VALUES (?,?,?,?,?)", AuthService.Hash(raw), account, family, clock.Now, clock.Now.AddDays(20));
}
await Token(customer, family1, raw1); await Token(customer, family2, raw2); await Token(admin, adminFamily, raw1 + "-admin");
void Act(long account, Role role, string? family)
{
    http.HttpContext!.Items["soopi.actor"] = new AuthenticatedActor(account, account == customer ? username : username + "-admin",
        new HashSet<Role> { role }, RolePermissions.ForRole(role), account == admin ? employeeCode : null, account == customer ? customerCode : null, "Probe");
    http.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(family is null ? [] : new[] { new Claim("sid", family) }));
}
void Check(bool condition, string label) { if (!condition) throw new Exception(label); Console.WriteLine("PASS " + label); }
async Task<long> Visits() => Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM LuotTruyCap WHERE MaTaiKhoan=?", customer));
AccessFilters Filter(DateOnly? from = null, DateOnly? to = null) => new(from, to, Q: username);
async Task<AccessSummary> Summary(DateOnly? from = null, DateOnly? to = null)
{
    Act(admin, Role.ADMIN, adminFamily); return await stats.SummaryAsync(Filter(from, to));
}
Act(customer, Role.CUSTOMER, family1);
await tracking.HeartbeatAsync(); Check(await Visits() == 0, "tracking never fabricates visits before 31/10/2026");
clock.Now = Local(2026, 10, 31, 9, 0);
await tracking.HeartbeatAsync(); await tracking.HeartbeatAsync();
Act(customer, Role.CUSTOMER, family1); await tracking.HeartbeatAsync();
Check(await Visits() == 1, "reload and same-session tabs count only once");
Act(customer, Role.CUSTOMER, family2); await tracking.HeartbeatAsync();
Check(await Visits() == 2, "a second login session counts as a second visit");
var first = await Summary();
Check(first.TotalVisits == 2 && first.Visits == 2 && first.Accounts == 1 && first.Online == 1, "multiple devices still count as one account online and one unique account");
var online = await stats.OnlineAsync(Filter(), 0, 25);
Check(online.Items.Single().Sessions == 2, "online table reports both live sessions");
await audit.RecordAsync(customerCode, username, ["CUSTOMER"], "AUTH_LOGIN_SUCCESS", "Đăng nhập", "ACCOUNT", customer.ToString());
await audit.RecordAsync(customerCode, username, ["CUSTOMER"], "AUTH_LOGIN_FAILED", "Thất bại", "ACCOUNT", customer.ToString());
await audit.RecordAsync("not-registered-" + suffix, username + "-unknown", ["ANONYMOUS"], "AUTH_LOGIN_FAILED", "Thất bại", "ACCOUNT", "not-registered-" + suffix);
Check((await stats.SummaryAsync(Filter())).Logins == 1 && (await stats.SummaryAsync(Filter())).Failed == 2, "login counters reuse audit; unknown names included in all-account failure count");
Check((await stats.SummaryAsync(Filter() with { Kind = "CUSTOMER" })).Failed == 1, "unknown attempts do not get attributed to a customer account");
clock.Now = clock.Now.AddMinutes(2);
Check((await Summary()).Online == 0, "online expires after two minutes without signals");
Act(customer, Role.CUSTOMER, family1); await tracking.HeartbeatAsync();
Check(await Visits() == 2, "short absence does not create another visit");
clock.Now = clock.Now.AddMinutes(30); await tracking.HeartbeatAsync();
Check(await Visits() == 3, "thirty-minute inactivity starts a new durable visit");
Act(admin, Role.ADMIN, family1);
Check(!await tracking.HeartbeatAsync(), "signed session cannot be used by a different account");
Act(customer, Role.CUSTOMER, null);
Check(!await tracking.HeartbeatAsync(), "legacy JWT requests a refresh instead of creating a duplicate session");
Act(customer, Role.CUSTOMER, family1);
clock.Now = Local(2026, 10, 31, 23, 59); await tracking.HeartbeatAsync();
var beforeMidnight = await Visits();
clock.Now = Local(2026, 11, 1, 0, 0).AddSeconds(15); await tracking.HeartbeatAsync();
Check(await Visits() == beforeMidnight, "midnight never resets or duplicates an ongoing visit");
var november = await Summary(new(2026, 11, 1), new(2026, 11, 1));
Check(november.TotalVisits == beforeMidnight && november.Visits == 0 && november.Accounts == 1 && november.Days.Single().Accounts == 1,
    "next day retains lifetime total and records a unique active account even without a new visit");
clock.Now = Local(2026, 11, 2, 8, 0); Act(customer, Role.CUSTOMER, family1); await tracking.HeartbeatAsync();
var accumulated = await Visits();
var all = await Summary();
Check(all.TotalVisits == accumulated && all.Visits == accumulated && all.Days.Count == 3, "all-history report persists across three calendar days");
var oldDay = await Summary(new(2026, 10, 31), new(2026, 10, 31));
Check(oldDay.Visits == beforeMidnight && oldDay.TotalVisits == accumulated, "historical date filter never overwrites cumulative total");
var restarted = new AccessStatisticsService(new Sql(db), actors, new AccessTrackingService(new Sql(db), actors, new TransactionRunner(db), clock), clock);
Check((await restarted.SummaryAsync(Filter())).TotalVisits == accumulated, "a new service instance reads the same persisted totals");
Act(customer, Role.CUSTOMER, family2); await tracking.HeartbeatAsync();
var auth = new AuthService(db, new AccountStore(db), null!, null!, null!, null!, audit, null!, null!, transactions, clock, tracking);
await auth.LogoutAsync(raw1, false);
Act(customer, Role.CUSTOMER, family1); Check(!await tracking.HeartbeatAsync(), "old access token cannot resurrect a logged-out session");
Check((await Summary()).Online == 1, "logging out one device leaves the other device online");
var logoutCount = Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaDoiTuong=? AND HanhDong='AUTH_LOGOUT'", customer.ToString()));
await auth.LogoutAsync(raw1, false);
Check(Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT_BIG(*) FROM NhatKyThaoTac WHERE MaDoiTuong=? AND HanhDong='AUTH_LOGOUT'", customer.ToString())) == logoutCount, "repeated logout does not duplicate audit");
await auth.LogoutAsync(raw2, true);
Check((await Summary()).Online == 0, "logout all revokes all online sessions");
await sql.ExecuteAsync("DELETE FROM RefreshToken WHERE MaTaiKhoan=?", customer);
Check((await Summary()).TotalVisits == accumulated + 1, "token cleanup never deletes visit history");
var logs = await stats.LogsAsync(Filter(), "AUTH_LOGIN_SUCCESS", 0, 25);
Check(logs.TotalItems == 1 && logs.Items.Single().Username == username, "login history filters action and account with stable pagination");
Check((await stats.LogsAsync(Filter() with { Q = username + "%" }, null, 0, 25)).TotalItems == 0, "search treats wildcard input literally");
var bytes = await stats.ExportAsync(Filter(), null); Check(bytes.Length > 0 && bytes[0] == 'P' && bytes[1] == 'K', "exports filtered lifetime and day history to XLSX");
Check(await tracking.StartDateAsync() == new DateOnly(2026, 10, 31), "migration reruns never move the tracking start date");
await rollback.RollbackAsync();
Console.WriteLine("PASS all access fixtures, audit rows and token changes rolled back.");
static DateTimeOffset Local(int y, int m, int d, int h, int min) => new(y, m, d, h, min, 0, DbTime.Offset);
sealed class ProbeClock : TimeProvider { public DateTimeOffset Now { get; set; } public override DateTimeOffset GetUtcNow() => Now.ToUniversalTime(); }
