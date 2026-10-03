using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Customers;

public enum CustomerProjection
{
    FULL,
    CONTACT,
    LIMITED,
    NONE,
}

public sealed record CustomerView(
    string Code, string? FullName, string? Phone, string? Email, string? Address, string Status, string? MergedInto, long? Version, bool HasAccount)
{
    public static CustomerView From(Customer customer, CustomerProjection projection)
    {
        var limited = projection == CustomerProjection.LIMITED;
        var none = projection == CustomerProjection.NONE;
        return new CustomerView(
            customer.Id,
            none ? null : customer.FullName,
            none ? null : limited ? Mask(customer.Phone) : customer.Phone,
            limited || none ? null : customer.Email,
            limited || none ? null : customer.Address,
            customer.Status.ToString(),
            customer.MergedInto,
            null,
            customer.AccountId is not null);
    }

    private static string Mask(string phone) => phone.Length < 7 ? "***" : phone[..4] + "***" + phone[^3..];

    /// <summary>Điều phối thấy đủ; có CUSTOMER_READ_CONTACT thấy liên hệ; KTV thấy hạn chế; còn lại không thấy.</summary>
    public static CustomerProjection ProjectionFor(AuthenticatedActor actor) =>
        actor.Roles.Contains(Role.DISPATCHER) ? CustomerProjection.FULL
        : actor.Permissions.Contains(Permission.CUSTOMER_READ_CONTACT) ? CustomerProjection.CONTACT
        : actor.Roles.Contains(Role.TECHNICIAN) ? CustomerProjection.LIMITED
        : CustomerProjection.NONE;
}

public sealed record CreateCustomerRequest([NotBlank] string FullName, [NotBlank] string Phone, string? Email, string? Address);

public sealed record UpdateContactRequest(string? Phone, string? Email, string? Address);

public sealed record MergeCustomerRequest([NotBlank] string TargetCode);

public sealed class CustomerService(
    AppDbContext db, Sql sql, CodeGenerator codes, CurrentActor actors, AuditService audit, TimeProvider clock, TransactionRunner transactions,
    CustomerAccountAdminService customerAccounts, SecurityVersionCache securityVersions)
{
    public async Task<PageResponse<CustomerView>> SearchAsync(string? query, int page, int size)
    {
        actors.Require(Permission.CUSTOMER_READ_CONTACT);
        new PageRequestParams(page, size, null).Validate();
        var projection = CustomerView.ProjectionFor(actors.Current);
        var customers = db.Customers.Where(c => c.Status == CustomerStatus.ACTIVE);
        if (!string.IsNullOrWhiteSpace(query))
        {
            var pattern = SqlLike.Contains(query.Trim());
            customers = customers.Where(c => EF.Functions.Like(c.Id, pattern) || EF.Functions.Like(c.FullName, pattern) || EF.Functions.Like(c.Phone, pattern));
        }
        var total = await customers.LongCountAsync();
        var items = await customers.OrderBy(c => c.FullName).ThenBy(c => c.Id).Skip(page * size).Take(size).AsNoTracking().ToListAsync();
        return PageResponse<CustomerView>.Of(items.Select(c => CustomerView.From(c, projection)).ToList(), page, size, total);
    }

    public async Task<CustomerView> GetAsync(string code)
    {
        actors.Require(Permission.CUSTOMER_READ_CONTACT);
        return View(await RequireActiveAsync(code));
    }

    /// <summary>Gọi lồng được (tiếp nhận tạo khách mới trong cùng transaction).</summary>
    public Task<CustomerView> CreateAsync(string fullName, string phone, string? email, string? address)
    {
        actors.Require(Permission.CUSTOMER_CREATE);
        return transactions.InTransactionAsync(async () =>
        {
            var customer = new Customer(await codes.NextAsync(BusinessCodeType.Customer), fullName, phone, email, address, clock.GetUtcNow());
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
            await AuditAsync("CUSTOMER_CREATED", "Thêm khách hàng", customer.Id, null, customer.FullName);
            return View(customer);
        });
    }

    /// <summary>Đổi SĐT của khách có tài khoản thì tên đăng nhập đổi theo và mọi phiên cũ bị đăng xuất.</summary>
    public async Task<CustomerView> UpdateContactAsync(string code, UpdateContactRequest body)
    {
        actors.Require(Permission.CUSTOMER_UPDATE_CONTACT);
        var (view, accountId) = await transactions.InTransactionAsync(async () =>
        {
            var customer = await RequireActiveAsync(code);
            var before = Summary(customer);
            var oldPhone = customer.Phone;
            customer.UpdateContact(body.Phone, body.Email, body.Address);
            await db.SaveChangesAsync();
            var changedAccount = await customerAccounts.FollowPhoneAsync(customer.AccountId, oldPhone, customer.Phone);
            await AuditAsync("CUSTOMER_CONTACT_UPDATED", "Cập nhật liên hệ khách hàng", code, before, Summary(customer));
            return (View(customer), changedAccount);
        });
        Evict(accountId);
        return view;
    }

    /// <summary>Hồ sơ lưu trữ không đăng nhập được nữa: khóa luôn tài khoản để trạng thái hiển thị đúng và thu hồi phiên.</summary>
    public async Task<CustomerView> ArchiveAsync(string code)
    {
        actors.Require(Permission.CUSTOMER_ARCHIVE);
        var (view, lockedAccount) = await transactions.InTransactionAsync(async () =>
        {
            var customer = await RequireActiveAsync(code);
            if (await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuTiepNhan WHERE MaKH = ? AND ConMo = 1", code) is not null)
                throw new DomainException(ErrorCode.CUSTOMER_HAS_OPEN_TICKETS);
            customer.Archive();
            await db.SaveChangesAsync();
            await AuditAsync("CUSTOMER_ARCHIVED", "Lưu trữ khách hàng", code, "ACTIVE", "ARCHIVED");
            var locked = await customerAccounts.LockForInactiveProfileAsync(code, customer.AccountId, "Hồ sơ đã lưu trữ");
            return (View(customer), locked);
        });
        Evict(lockedAccount);
        return view;
    }

    /// <summary>
    /// Chuyển thiết bị, phiếu và tài khoản tra cứu sang hồ sơ đích (như sp_HopNhatKhachHang). Hồ sơ đích đã có tài khoản thì
    /// tài khoản của hồ sơ nguồn bị khóa.
    /// </summary>
    public async Task<CustomerView> MergeAsync(string sourceCode, string targetCode)
    {
        actors.Require(Permission.CUSTOMER_MERGE);
        if (sourceCode == targetCode) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var (view, lockedAccount) = await transactions.InTransactionAsync(async () =>
        {
            var source = await RequireActiveAsync(sourceCode);
            var target = await RequireActiveAsync(targetCode);
            await sql.ExecuteAsync("UPDATE ThietBi SET MaKH = ? WHERE MaKH = ?", targetCode, sourceCode);
            // Tăng PhienBan để lần lưu phiếu đọc trước khi gộp không ghi đè ngược MaKH (optimistic lock của phiếu).
            await sql.ExecuteAsync("UPDATE PhieuTiepNhan SET MaKH = ?, PhienBan = PhienBan + 1 WHERE MaKH = ?", targetCode, sourceCode);
            long? locked = null;
            if (source.AccountId is { } account && target.AccountId is null)
            {
                await sql.ExecuteAsync("UPDATE KhachHang SET MaTaiKhoan = NULL WHERE MaKH = ?", sourceCode);
                await sql.ExecuteAsync("UPDATE KhachHang SET MaTaiKhoan = ? WHERE MaKH = ?", account, targetCode);
            }
            else if (source.AccountId is { } orphan)
            {
                locked = await customerAccounts.LockForInactiveProfileAsync(sourceCode, orphan, "Hồ sơ đã gộp vào " + targetCode);
            }
            source.MergeInto(targetCode);
            await db.SaveChangesAsync();
            await AuditAsync("CUSTOMER_MERGED", "Hợp nhất khách hàng", sourceCode, sourceCode, targetCode);
            return (View(target), locked);
        });
        Evict(lockedAccount);
        return view;
    }

    public async Task<Customer> RequireActiveAsync(string code) =>
        await db.Customers.FirstOrDefaultAsync(c => c.Id == code && c.Status == CustomerStatus.ACTIVE)
        ?? throw new DomainException(ErrorCode.CUSTOMER_NOT_FOUND);

    private void Evict(long? accountId)
    {
        if (accountId is { } id) securityVersions.Evict(id);
    }

    private CustomerView View(Customer customer) => CustomerView.From(customer, CustomerView.ProjectionFor(actors.Current));

    private static string Summary(Customer customer) => customer.FullName + " — " + customer.Phone;

    private Task AuditAsync(string action, string label, string entityId, string? before, string? after)
    {
        var actor = actors.Current;
        return audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "CUSTOMER", entityId, before, after);
    }
}
