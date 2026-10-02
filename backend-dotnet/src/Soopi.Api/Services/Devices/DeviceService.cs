using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Devices;

public sealed record DeviceWarranty(string Status, string? PolicyId, string? Conditions, string? RejectionCases, string? Distributor);

public sealed record DeviceView(
    string Code,
    string ProductId,
    IReadOnlyDictionary<string, string?> Product,
    string IdentifierType,
    string SerialOrImei,
    string? CustomerCode,
    DateOnly? WarrantyActivatedOn,
    DateOnly? WarrantyExpiresOn,
    string? Distributor,
    DeviceWarranty Warranty,
    IReadOnlyList<Dictionary<string, object?>> Tickets,
    long? Version);

public sealed record RegisterDeviceRequest(
    [NotBlank] string CustomerCode,
    [NotBlank] string ProductId,
    [NotNull] IdentifierType? IdentifierType,
    [NotBlank] string SerialOrImei,
    DateOnly? WarrantyActivatedOn,
    DateOnly? WarrantyExpiresOn,
    string? Distributor);

public sealed class DeviceService(
    AppDbContext db,
    Sql sql,
    ProductCatalog catalog,
    CustomerService customers,
    CodeGenerator codes,
    CurrentActor actors,
    AuditService audit,
    TimeProvider clock,
    TransactionRunner transactions)
{
    /// <summary>Gọi lồng được (tiếp nhận đăng ký thiết bị mới trong cùng transaction).</summary>
    public Task<DeviceView> RegisterAsync(RegisterDeviceRequest request)
    {
        actors.Require(Permission.DEVICE_REGISTER);
        return transactions.InTransactionAsync(async () =>
        {
            if (request.IdentifierType is not { } identifierType || string.IsNullOrWhiteSpace(request.SerialOrImei))
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
            await customers.RequireActiveAsync(request.CustomerCode);
            var product = await catalog.RequireProductAsync(request.ProductId);
            if (identifierType.ToString() != product.Snapshot["identifierType"]) throw new DomainException(ErrorCode.VALIDATION_FAILED);
            var months = product.PolicyWarrantyMonths ?? product.DefaultWarrantyMonths;
            var expiry = request.WarrantyExpiresOn is null && request.WarrantyActivatedOn is { } activated
                ? activated.AddMonths(months)
                : request.WarrantyExpiresOn;
            var device = new Device(
                await codes.NextAsync(BusinessCodeType.Device), request.ProductId, identifierType, request.SerialOrImei,
                request.CustomerCode, request.WarrantyActivatedOn, expiry, request.Distributor ?? product.Distributor, clock.GetUtcNow());
            db.Devices.Add(device);
            await db.SaveChangesAsync();
            var actor = actors.Current;
            await audit.RecordAsync(
                actor.AuditId, actor.DisplayName, actor.RoleNames, "DEVICE_REGISTERED", "Đăng ký thiết bị", "DEVICE", device.Id,
                null, device.Id + " — " + device.SerialOrImei + " — " + request.CustomerCode);
            return await ViewAsync(device, product);
        });
    }

    public async Task<DeviceView> LookupAsync(string? serial)
    {
        actors.Require(Permission.DEVICE_LOOKUP);
        var normalized = SerialNumber.Normalize(serial);
        var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(d => d.SerialNormalized == normalized)
            ?? throw new DomainException(ErrorCode.DEVICE_NOT_FOUND);
        return await ViewAsync(device, await catalog.RequireProductAsync(device.ProductId));
    }

    public async Task<List<DeviceView>> ListForCustomerAsync(string customerCode)
    {
        actors.Require(Permission.CUSTOMER_READ_CONTACT);
        await customers.RequireActiveAsync(customerCode);
        return await ListByCustomerAsync(customerCode);
    }

    /// <summary>App khách hàng: thiết bị đứng tên chính khách đang đăng nhập.</summary>
    public async Task<List<DeviceView>> ListOwnedAsync()
    {
        var customerCode = actors.Require(Permission.PORTAL_SELF).CustomerId ?? throw new DomainException(ErrorCode.ACCESS_DENIED);
        return await ListByCustomerAsync(customerCode);
    }

    private async Task<List<DeviceView>> ListByCustomerAsync(string customerCode)
    {
        var devices = await db.Devices.AsNoTracking().Where(d => d.CustomerId == customerCode).OrderBy(d => d.CreatedAt).ToListAsync();
        var views = new List<DeviceView>();
        foreach (var device in devices) views.Add(await ViewAsync(device, await catalog.RequireProductAsync(device.ProductId)));
        return views;
    }

    private async Task<DeviceView> ViewAsync(Device device, ProductInfo product)
    {
        var today = DbTime.Date(clock.GetUtcNow());
        var status = device.WarrantyExpiresOn is not { } expires ? "NOT_ACTIVATED" : expires < today ? "OUT_OF_WARRANTY" : "IN_WARRANTY";
        var tickets = await sql.QueryAsync(
            "SELECT TOP 20 MaPhieuTN, TrangThaiXuLy, NgayTiepNhan, MoTaLoiKhachBao FROM PhieuTiepNhan WHERE MaThietBi = ? ORDER BY NgayTiepNhan DESC",
            row => new Dictionary<string, object?>
            {
                ["_id"] = row.Str("MaPhieuTN"),
                ["status"] = row.Str("TrangThaiXuLy"),
                ["receivedAt"] = row.Time("NgayTiepNhan"),
                ["reportedIssue"] = row.Str("MoTaLoiKhachBao"),
            },
            device.Id);
        return new DeviceView(
            device.Id, device.ProductId, product.Snapshot, device.IdentifierType.ToString(), device.SerialOrImei, device.CustomerId,
            device.WarrantyActivatedOn, device.WarrantyExpiresOn, device.Distributor,
            new DeviceWarranty(status, product.PolicyId, product.Conditions, product.RejectionCases, device.Distributor),
            tickets, null);
    }
}
