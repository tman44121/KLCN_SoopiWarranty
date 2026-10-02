using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Domain.Identity;

/// <summary>Thứ tự khai báo là thứ tự sắp xếp (vai trò đầu tiên quyết định trang đích), giữ như enum Java.</summary>
public enum Role
{
    ADMIN,
    RECEPTIONIST,
    DISPATCHER,
    TECHNICIAN,
    WAREHOUSE_KEEPER,
    CASHIER,
    CUSTOMER,
}

public enum Permission
{
    TICKET_CREATE,
    TICKET_READ_ALL,
    TICKET_READ_ASSIGNED,
    TICKET_READ_WAREHOUSE_VIEW,
    TICKET_ASSIGN,
    TICKET_REASSIGN,
    TICKET_DIAGNOSE,
    TICKET_REPAIR,
    TICKET_NOTE_CUSTOMER,
    TICKET_NOTE_INTERNAL,
    QUOTE_CREATE,
    QUOTE_REVIEW,
    QUOTE_DECIDE_ON_BEHALF,
    QUOTE_DECIDE_OWN,
    STOCK_ISSUE_REQUEST,
    STOCK_ISSUE_PROCESS,
    STOCK_RECEIPT_MANAGE,
    STOCK_TRANSFER_MANAGE,
    INVENTORY_READ,
    INVENTORY_READ_COST,
    PAYMENT_COLLECT,
    PAYMENT_READ,
    HANDOVER_COMPLETE,
    CUSTOMER_CREATE,
    CUSTOMER_UPDATE_CONTACT,
    CUSTOMER_READ_CONTACT,
    CUSTOMER_READ_PAYMENTS,
    CUSTOMER_MERGE,
    CUSTOMER_ARCHIVE,
    DEVICE_REGISTER,
    DEVICE_LOOKUP,
    WARRANTY_REQUEST_HANDLE,
    CATALOG_READ,
    CATALOG_MANAGE,
    ACCOUNT_MANAGE,
    REPORT_OPERATIONS,
    REPORT_SYSTEM,
    AUDIT_READ,
    PORTAL_SELF,
}

public static class Roles
{
    private static readonly Dictionary<Role, (string Label, string Landing)> Info = new()
    {
        [Role.ADMIN] = ("Quản trị viên", "/admin"),
        [Role.RECEPTIONIST] = ("Tiếp nhận & Lễ tân", "/receptionist"),
        [Role.DISPATCHER] = ("Điều phối viên", "/dispatch"),
        [Role.TECHNICIAN] = ("Kỹ thuật viên", "/technician"),
        [Role.WAREHOUSE_KEEPER] = ("Quản lý kho vật tư", "/warehouse"),
        [Role.CASHIER] = ("Thu ngân & Bàn giao", "/cashier"),
        [Role.CUSTOMER] = ("Khách hàng", "/account"),
    };

    public static string Label(this Role role) => Info[role].Label;

    /// <summary>Route React của màn chính (bản Java là pages/*.html).</summary>
    public static string Landing(this Role role) => Info[role].Landing;

    public static Role Parse(string value) =>
        Enum.TryParse<Role>(value, ignoreCase: false, out var role) && Enum.IsDefined(role)
            ? role
            : throw new DomainException(ErrorCode.VALIDATION_FAILED);
}

/// <summary>Ma trận vai trò → quyền (chép nguyên từ RolePermissions của bản Java).</summary>
public static class RolePermissions
{
    private static readonly Dictionary<Role, HashSet<Permission>> Matrix = new()
    {
        [Role.ADMIN] =
        [
            Permission.CATALOG_READ, Permission.CATALOG_MANAGE, Permission.ACCOUNT_MANAGE, Permission.REPORT_OPERATIONS,
            Permission.REPORT_SYSTEM, Permission.AUDIT_READ,
        ],
        [Role.RECEPTIONIST] =
        [
            Permission.TICKET_CREATE, Permission.TICKET_READ_ALL, Permission.TICKET_NOTE_INTERNAL,
            Permission.QUOTE_DECIDE_ON_BEHALF, Permission.HANDOVER_COMPLETE, Permission.CUSTOMER_CREATE,
            Permission.CUSTOMER_UPDATE_CONTACT, Permission.CUSTOMER_READ_CONTACT, Permission.DEVICE_REGISTER,
            Permission.DEVICE_LOOKUP, Permission.WARRANTY_REQUEST_HANDLE, Permission.CATALOG_READ,
        ],
        [Role.DISPATCHER] =
        [
            Permission.TICKET_READ_ALL, Permission.TICKET_ASSIGN, Permission.TICKET_REASSIGN,
            Permission.TICKET_NOTE_CUSTOMER, Permission.TICKET_NOTE_INTERNAL, Permission.QUOTE_REVIEW,
            Permission.QUOTE_DECIDE_ON_BEHALF, Permission.INVENTORY_READ, Permission.INVENTORY_READ_COST,
            Permission.PAYMENT_READ, Permission.HANDOVER_COMPLETE, Permission.CUSTOMER_CREATE,
            Permission.CUSTOMER_UPDATE_CONTACT, Permission.CUSTOMER_READ_CONTACT, Permission.CUSTOMER_READ_PAYMENTS,
            Permission.CUSTOMER_MERGE, Permission.CUSTOMER_ARCHIVE, Permission.DEVICE_REGISTER, Permission.DEVICE_LOOKUP,
            Permission.WARRANTY_REQUEST_HANDLE, Permission.CATALOG_READ, Permission.REPORT_OPERATIONS,
            Permission.AUDIT_READ,
        ],
        [Role.TECHNICIAN] =
        [
            Permission.TICKET_READ_ASSIGNED, Permission.TICKET_DIAGNOSE, Permission.TICKET_REPAIR,
            Permission.TICKET_NOTE_CUSTOMER, Permission.TICKET_NOTE_INTERNAL, Permission.QUOTE_CREATE,
            Permission.STOCK_ISSUE_REQUEST, Permission.INVENTORY_READ, Permission.CATALOG_READ,
        ],
        [Role.WAREHOUSE_KEEPER] =
        [
            Permission.TICKET_READ_WAREHOUSE_VIEW, Permission.STOCK_ISSUE_REQUEST, Permission.STOCK_ISSUE_PROCESS,
            Permission.STOCK_RECEIPT_MANAGE, Permission.STOCK_TRANSFER_MANAGE, Permission.INVENTORY_READ,
            Permission.INVENTORY_READ_COST, Permission.CATALOG_READ,
        ],
        [Role.CASHIER] =
        [
            Permission.TICKET_READ_ALL, Permission.PAYMENT_COLLECT, Permission.PAYMENT_READ, Permission.HANDOVER_COMPLETE,
            Permission.CUSTOMER_READ_CONTACT, Permission.CUSTOMER_READ_PAYMENTS, Permission.CATALOG_READ,
        ],
        [Role.CUSTOMER] = [Permission.QUOTE_DECIDE_OWN, Permission.PORTAL_SELF],
    };

    public static IReadOnlySet<Permission> ForRole(Role role) => Matrix[role];

    public static IReadOnlySet<Permission> ForRoles(IEnumerable<Role> roles) =>
        roles.SelectMany(role => Matrix[role]).ToHashSet();
}

public sealed record AuthenticatedActor(
    long? AccountId,
    string Username,
    IReadOnlySet<Role> Roles,
    IReadOnlySet<Permission> Permissions,
    string? EmployeeId,
    string? CustomerId,
    string? DisplayName)
{
    /// <summary>Mã người thao tác ghi vào nhật ký: mã NV, "KH:&lt;mã KH&gt;" hoặc mã tài khoản.</summary>
    public string AuditId =>
        EmployeeId ?? (CustomerId is not null ? "KH:" + CustomerId : AccountId?.ToString() ?? "SYSTEM");

    /// <summary>Danh sách vai trò theo thứ tự khai báo, như actor.roles() trong nhật ký của bản Java.</summary>
    public IReadOnlyList<string> RoleNames => Roles.Order().Select(role => role.ToString()).ToList();
}

public enum PortalScope
{
    TICKET,
    REQUEST,
}

/// <summary>Quyền truy cập ngắn hạn cấp qua tra cứu Mã + SĐT: chỉ đúng một phiếu TN hoặc một yêu cầu YC.</summary>
public sealed record PortalGrant(PortalScope Scope, string Code)
{
    public const string Authority = "PORTAL_TOKEN";

    public bool AllowsTicket(string ticketCode) => Scope == PortalScope.TICKET && Code == ticketCode;

    public bool AllowsRequest(string requestCode) => Scope == PortalScope.REQUEST && Code == requestCode;

    public string Claim() => Prefix(Scope) + Code;

    public static PortalGrant? FromClaim(string? value)
    {
        foreach (var scope in Enum.GetValues<PortalScope>())
        {
            if (value is not null && value.StartsWith(Prefix(scope), StringComparison.Ordinal))
                return new PortalGrant(scope, value[Prefix(scope).Length..]);
        }
        return null;
    }

    private static string Prefix(PortalScope scope) => scope == PortalScope.TICKET ? "ticket:" : "request:";
}
