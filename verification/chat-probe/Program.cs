// Run from repository root against a local demo database. All fixtures are rolled back.
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Chat;

var config = new ConfigurationBuilder().AddUserSecrets(typeof(ChatService).Assembly).AddEnvironmentVariables().Build();
await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(config.GetConnectionString("Default")).Options);
var sql = new Sql(db);
var migration = File.ReadAllText("database/06_chat.sql");
if (args.Contains("--apply-schema"))
{
    foreach (var batch in Regex.Split(migration, @"^GO\s*$", RegexOptions.Multiline))
        if (!string.IsNullOrWhiteSpace(batch)) await sql.ExecuteAsync(batch);
    Console.WriteLine("APPLIED chat tables only; no demo conversations or messages created.");
    return;
}
await using var rollback = await db.Database.BeginTransactionAsync();
// Skip the script's transaction wrapper because fixtures must never be committed.
migration = migration[migration.IndexOf("IF OBJECT_ID")..migration.LastIndexOf("COMMIT;")];
foreach (var batch in Regex.Split(migration, @"^GO\s*$", RegexOptions.Multiline))
    if (!string.IsNullOrWhiteSpace(batch)) await sql.ExecuteAsync(batch);
var sample = await sql.FirstOrDefaultAsync("""
    SELECT TOP 1 p.MaPhieuTN,k.MaTaiKhoan AS CustomerAccount,k.MaKH,e.MaTaiKhoan AS StaffAccount,e.MaNV
    FROM PhieuTiepNhan p JOIN KhachHang k ON k.MaKH=p.MaKH JOIN TaiKhoan ck ON ck.MaTaiKhoan=k.MaTaiKhoan
    JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN JOIN NhanVien e ON e.MaNV=pc.MaKTV
    JOIN TaiKhoan ek ON ek.MaTaiKhoan=e.MaTaiKhoan
    WHERE ck.TrangThai='ACTIVE' AND ek.TrangThai='ACTIVE' AND k.TrangThai='ACTIVE' AND e.TrangThaiLamViec='ACTIVE'
      AND e.MaNV<>p.MaNVTiepNhan ORDER BY p.MaPhieuTN
    """, r => new { Ticket = r.Str("MaPhieuTN")!, Customer = r.Long("CustomerAccount"), CustomerId = r.Str("MaKH")!, Staff = r.Long("StaffAccount"), EmployeeId = r.Str("MaNV")! })
    ?? throw new Exception("Need an assigned demo ticket with active customer and technician accounts.");
var replacement = await sql.FirstOrDefaultAsync("""
    SELECT TOP 1 e.MaTaiKhoan,e.MaNV FROM NhanVien e JOIN TaiKhoan a ON a.MaTaiKhoan=e.MaTaiKhoan
    JOIN TaiKhoan_VaiTro v ON v.MaTaiKhoan=a.MaTaiKhoan AND v.MaVaiTro='TECHNICIAN'
    WHERE a.TrangThai='ACTIVE' AND e.TrangThaiLamViec='ACTIVE' AND e.MaNV<>?
      AND e.MaNV<>(SELECT MaNVTiepNhan FROM PhieuTiepNhan WHERE MaPhieuTN=?)
    """, r => new { Account = r.Long("MaTaiKhoan"), Employee = r.Str("MaNV")! }, sample.EmployeeId, sample.Ticket)
    ?? throw new Exception("Need a second active technician for reassignment checks.");
var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
void Actor(long account, Role role, string? employee = null, string? customer = null) => http.HttpContext.Items["soopi.actor"] =
    new AuthenticatedActor(account, "probe", new HashSet<Role> { role }, RolePermissions.ForRole(role), employee, customer, "Probe");
void Customer() => Actor(sample.Customer, Role.CUSTOMER, customer: sample.CustomerId);
void Staff() => Actor(sample.Staff, Role.TECHNICIAN, sample.EmployeeId);
var chat = new ChatService(sql, new CurrentActor(http), new TransactionRunner(db), TimeProvider.System);
void Check(bool ok, string label) { if (!ok) throw new Exception(label); Console.WriteLine("PASS " + label); }
async Task Denied(Func<Task> action, ErrorCode code, string label)
{
    try { await action(); throw new Exception("Unexpected authorization: " + label); }
    catch (DomainException e) when (e.Code == code) { Console.WriteLine("PASS " + label); }
}
Customer();
var contacts = await chat.ContactsAsync(sample.Ticket, 0);
Check(contacts.Items.Any(c => c.StaffAccountId == sample.Staff.ToString() && c.CanSend), "customer sees assigned technician by ticket");
var id = await chat.StartAsync(sample.Ticket, sample.Staff.ToString());
Staff();
Check(await chat.StartAsync(sample.Ticket, sample.Staff.ToString()) == id, "both initiators use the same unique conversation");
var staffDirectory = await chat.ContactsAsync(sample.CustomerId, 0);
Check(staffDirectory.Items.Any(c => c.ConversationId == id), "technician searches own customer without global contact permission");
var request = Guid.NewGuid().ToString();
var text = new string('a', 1998) + "🌟";
var sent = await chat.SendAsync(id, text, request);
Check((await chat.SendAsync(id, text, request)).Id == sent.Id, "network retry cannot duplicate a message");
await Denied(async () => { await chat.SendAsync(id, "changed", request); }, ErrorCode.VALIDATION_FAILED, "same request id cannot change a message");
await Denied(async () => { await chat.SendAsync(id, " ", Guid.NewGuid().ToString()); }, ErrorCode.VALIDATION_FAILED, "blank messages rejected");
await Denied(async () => { await chat.SendAsync(id, new string('a', 2001), Guid.NewGuid().ToString()); }, ErrorCode.VALIDATION_FAILED, "oversized messages rejected without truncation");
Customer();
var history = await chat.MessagesAsync(id, null);
Check(history.Items.Any(m => m.Id == sent.Id && !m.Mine && m.Text == text), "Unicode message persists and belongs to the other participant");
await chat.ReadAsync(id, sent.Id);
Check((await chat.ContactsAsync(sample.Ticket, 0)).Items.Single(c => c.ConversationId == id).UnreadCount == 0, "only displayed messages marked read");
Staff();
var next = await chat.SendAsync(id, "Reply", Guid.NewGuid().ToString());
Customer();
await chat.ReadAsync(id, sent.Id);
Check((await chat.ContactsAsync(sample.Ticket, 0)).Items.Single(c => c.ConversationId == id).UnreadCount == 1, "older read receipt cannot clear a newer message");
var reply = await chat.SendAsync(id, "Khách trả lời\n<img src=x onerror=alert(1)>", Guid.NewGuid().ToString());
Staff();
Check((await chat.MessagesAsync(id, null)).Items.Any(m => m.Id == reply.Id && !m.Mine), "customer reply reaches the technician");
Actor(replacement.Account, Role.TECHNICIAN, replacement.Employee);
Check((await chat.ContactsAsync(sample.Ticket, 0)).Items.Count == 0, "unassigned technician cannot discover the customer");
await Denied(async () => { await chat.MessagesAsync(id, null); }, ErrorCode.NOT_FOUND, "nonparticipant cannot read conversation by guessing its id");
await Denied(async () => { await chat.StartAsync(sample.Ticket, sample.Staff.ToString()); }, ErrorCode.NOT_FOUND, "staff cannot impersonate another staff member");
await sql.ExecuteAsync("UPDATE PhanCong SET MaKTV=? WHERE MaPhieuTN=?", replacement.Employee, sample.Ticket);
Staff();
Check(!(await chat.MessagesAsync(id, null)).CanSend, "former technician keeps read-only history");
await Denied(async () => { await chat.SendAsync(id, "Old staff", Guid.NewGuid().ToString()); }, ErrorCode.ACCESS_DENIED, "reassignment revokes sending immediately");
Customer();
var changed = await chat.ContactsAsync(sample.Ticket, 0);
Check(changed.Items.Any(c => c.ConversationId == id && !c.CanSend) && changed.Items.Any(c => c.StaffAccountId == replacement.Account.ToString() && c.CanSend), "customer sees old history and new technician separately");
await Denied(async () => { await chat.SendAsync(id, "Old recipient", Guid.NewGuid().ToString()); }, ErrorCode.ACCESS_DENIED, "customer cannot send into a former assignment");
var newId = await chat.StartAsync(sample.Ticket, replacement.Account.ToString());
Check(newId != id && (await chat.MessagesAsync(newId, null)).Items.Count == 0, "new technician has a separate empty conversation");
await Denied(() => chat.ReadAsync(newId, next.Id), ErrorCode.NOT_FOUND, "read receipt cannot reference another conversation");
Actor(replacement.Account, Role.TECHNICIAN, replacement.Employee);
await Denied(async () => { await chat.MessagesAsync(id, null); }, ErrorCode.NOT_FOUND, "new technician never inherits the old private messages");
Customer();
await sql.ExecuteAsync("UPDATE TaiKhoan SET TrangThai='LOCKED' WHERE MaTaiKhoan=?", replacement.Account);
Check(!(await chat.MessagesAsync(newId, null)).CanSend, "locked recipient cannot receive new messages");
await Denied(async () => { await chat.SendAsync(newId, "Locked", Guid.NewGuid().ToString()); }, ErrorCode.ACCESS_DENIED, "locked recipient checked at write boundary");
await sql.ExecuteAsync("UPDATE TaiKhoan SET TrangThai='ACTIVE' WHERE MaTaiKhoan=?", replacement.Account);
for (var n = 0; n < 55; n++)
    await sql.ExecuteAsync("INSERT TinNhan (MaHoiThoai,MaNguoiGui,MaYeuCau,NoiDung,NgayTao) VALUES (?,?,?,?,?)", newId, sample.Customer, Guid.NewGuid(), "History " + n, DateTimeOffset.UtcNow);
var latest = await chat.MessagesAsync(newId, null);
var previous = await chat.MessagesAsync(newId, latest.Items[0].Id);
Check(latest.Items.Count == 50 && latest.HasMore && previous.Items.Count == 5 && !previous.HasMore
    && !latest.Items.Select(m => m.Id).Intersect(previous.Items.Select(m => m.Id)).Any(), "message pagination retains all history without overlap");
var forward = await chat.MessagesAsync(newId, null, "0");
var forwardNext = await chat.MessagesAsync(newId, null, forward.Items[^1].Id);
Check(forward.Items.Count == 50 && forward.HasMore && forwardNext.Items.Count == 5 && !forwardNext.HasMore
    && forward.Items.Concat(forwardNext.Items).Select(m => m.Id).Distinct().Count() == 55, "incremental polling delivers every new message in ascending pages");
await rollback.RollbackAsync();
Console.WriteLine("PASS all chat fixtures rolled back; no messages or assignments changed permanently.");
