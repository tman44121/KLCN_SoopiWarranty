using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Files;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.WarrantyRequests;

/// <summary>Lễ tân xử lý yêu cầu bảo hành online: xem, tìm, hủy.</summary>
public sealed class WarrantyRequestService(
    WarrantyRequestStore store, CurrentActor actors, TransactionRunner transactions, AuditService audit, NotificationService notifications, TimeProvider clock)
{
    public Task<List<Dictionary<string, object?>>> SearchAsync(string? status, string? query)
    {
        actors.Require(Permission.WARRANTY_REQUEST_HANDLE);
        return store.SearchAsync(status, query);
    }

    public async Task<Dictionary<string, object?>> GetAsync(string code)
    {
        actors.Require(Permission.WARRANTY_REQUEST_HANDLE);
        return await store.FindAsync(code) ?? throw new DomainException(ErrorCode.NOT_FOUND);
    }

    public Task<Dictionary<string, object?>> CancelAsync(string code, string? reason)
    {
        var actor = actors.Require(Permission.WARRANTY_REQUEST_HANDLE);
        if (JavaText.IsBlank(reason)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return transactions.InTransactionAsync(async () =>
        {
            if (!await store.IsPendingAsync(code)) throw new DomainException(ErrorCode.WARRANTY_REQUEST_NOT_PENDING);
            await store.CancelAsync(code, JavaText.Trim(reason), actor.EmployeeId, clock.GetUtcNow());
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "WARRANTY_REQUEST_CANCELLED", "Hủy yêu cầu bảo hành",
                "WARRANTY_REQUEST", code, "PENDING_INTAKE", "CANCELLED");
            var cancelled = await GetAsync(code);
            if (cancelled["customer"] is Dictionary<string, object?> customer && customer["phone"] is string phone)
                await notifications.ForCustomerPhoneAsync(phone, "WARRANTY_REQUEST_CANCELLED", $"Yêu cầu bảo hành {code} đã bị hủy: {JavaText.Trim(reason)}", code);
            return cancelled;
        });
    }
}

public sealed record SubmissionCommand(
    string? FullName,
    string? Phone,
    string? Email,
    string? Address,
    string? CategoryCode,
    string? DeviceTypeCode,
    string? BrandModel,
    string? IdentifierType,
    string? SerialOrImei,
    string? Symptom,
    string? PreferredStation,
    DateTimeOffset? PreferredFrom,
    DateTimeOffset? PreferredTo);

/// <summary>Khách tự đăng ký yêu cầu bảo hành trên cổng khách (công khai) hoặc app.</summary>
public sealed class WarrantyRequestSubmissionService(
    WarrantyRequestStore store,
    CatalogStore catalog,
    AttachmentService attachments,
    CodeGenerator codes,
    TransactionRunner transactions,
    NotificationService notifications,
    TimeProvider clock)
{
    public Task<string> SubmitAsync(SubmissionCommand command, IReadOnlyList<Upload> uploads) =>
        transactions.InTransactionAsync(async () =>
        {
            await RequireDeviceTypeAsync(command.CategoryCode, command.DeviceTypeCode, command.IdentifierType);
            await RequireStationAsync(command.PreferredStation);
            var request = Validated(await codes.NextAsync(BusinessCodeType.WarrantyRequest), command, clock.GetUtcNow());
            var stored = new List<Attachment>();
            try
            {
                stored.AddRange(await attachments.StoreWarrantyRequestFilesAsync(request.Code, uploads));
                await store.InsertAsync(request);
            }
            catch
            {
                await attachments.DiscardAsync(stored);
                throw;
            }
            await notifications.ForRoleAsync("RECEPTIONIST", "WARRANTY_REQUEST_NEW", $"Có yêu cầu bảo hành trực tuyến mới {request.Code}.",
                "/receptionist#" + request.Code, request.Code);
            return request.Code;
        });

    /// <summary>Luật của NewWarrantyRequest (Java): đủ trường, khung giờ hợp lệ, SĐT/IMEI/Serial chuẩn hóa.</summary>
    public static NewWarrantyRequest Validated(string code, SubmissionCommand c, DateTimeOffset now)
    {
        if (Blank(c.FullName) || Blank(c.CategoryCode) || Blank(c.DeviceTypeCode) || Blank(c.BrandModel) || Blank(c.Symptom)
            || Blank(c.PreferredStation) || (c.PreferredFrom is { } from && c.PreferredTo is { } to && to < from))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var phone = PhoneNumber.Require(c.Phone);
        var serial = c.IdentifierType switch
        {
            "IMEI" => Imei.Require(c.SerialOrImei),
            "SERIAL" => SerialNumber.Require(c.SerialOrImei),
            _ => throw new DomainException(ErrorCode.VALIDATION_FAILED),
        };
        return new NewWarrantyRequest(
            code, JavaText.Trim(c.FullName!), phone, TrimToNull(c.Email), TrimToNull(c.Address), c.CategoryCode!, c.DeviceTypeCode!,
            JavaText.Trim(c.BrandModel!), c.IdentifierType, serial, JavaText.Trim(c.Symptom!), c.PreferredStation!, c.PreferredFrom, c.PreferredTo, now);
    }

    private async Task RequireDeviceTypeAsync(string? categoryCode, string? deviceTypeCode, string? identifierType)
    {
        var category = categoryCode is null ? null : await catalog.FindAsync("device_categories", categoryCode);
        var matches = category?["active"] is true
            && category["deviceTypes"] is IEnumerable<object?> types
            && types.OfType<Dictionary<string, object?>>().Any(type =>
                deviceTypeCode is not null && deviceTypeCode == type["code"] as string
                && identifierType is not null && identifierType == type["identifierType"] as string);
        if (!matches) throw new DomainException(ErrorCode.VALIDATION_FAILED);
    }

    private async Task RequireStationAsync(string? stationCode)
    {
        var station = stationCode is null ? null : await catalog.FindAsync("service_stations", stationCode);
        if (station?["active"] is not true) throw new DomainException(ErrorCode.VALIDATION_FAILED);
    }

    private static bool Blank(string? value) => JavaText.IsBlank(value);

    private static string? TrimToNull(string? value) => Blank(value) ? null : JavaText.Trim(value!);
}
