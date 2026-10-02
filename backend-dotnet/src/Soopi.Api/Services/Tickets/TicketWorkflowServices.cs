using Soopi.Api.Data;
using Soopi.Api.Data.Entities;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Devices;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Tickets;

public sealed record NewCustomer([NotBlank] string FullName, [NotBlank] string Phone, string? Email, string? Address);

public sealed record CustomerInput(string? Code, NewCustomer? NewCustomer);

public sealed record NewDevice(
    [NotBlank] string ProductId, [NotNull] IdentifierType? IdentifierType, [NotBlank] string SerialOrImei,
    DateOnly? WarrantyActivatedOn, DateOnly? WarrantyExpiresOn, string? Distributor);

public sealed record DeviceInput(string? Code, NewDevice? NewDevice);

public sealed record ReceiveCommand(
    CustomerInput Customer, DeviceInput Device, string? WarrantyRequestCode, Channel? Channel, RequestType? RequestType, string? SealCondition,
    Cosmetic Cosmetic, string ReportedIssue, DateTimeOffset? PromisedReturnAt, decimal? EstimatedCost, SlaLevel? SlaLevel);

/// <summary>Lập phiếu tiếp nhận (BR: một phiếu mở mỗi thiết bị, SLA, bảo hành lúc nhận, yêu cầu online chuyển thành phiếu).</summary>
public sealed class ReceptionService(
    TicketStore tickets,
    Sql sql,
    ProductCatalog catalog,
    WarrantyRequestStore warrantyRequests,
    CustomerService customers,
    DeviceService devices,
    StaffDirectory staff,
    CodeGenerator codes,
    CurrentActor actors,
    TransactionRunner transactions,
    AuditService audit,
    NotificationService notifications,
    TicketQueryService views,
    TimeProvider clock)
{
    public Task<TicketView> ReceiveAsync(ReceiveCommand command)
    {
        actors.Require(Permission.TICKET_CREATE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            var receptionist = await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.RECEPTIONIST);
            var customerCode = await CustomerCodeAsync(command.Customer);
            var deviceCode = await DeviceCodeAsync(command.Device, customerCode);
            var now = clock.GetUtcNow();
            if (await tickets.HasOpenForDeviceAsync(deviceCode)) throw new DomainException(ErrorCode.DEVICE_HAS_OPEN_TICKET);
            if (command.WarrantyRequestCode is not null) await warrantyRequests.RequirePendingAsync(command.WarrantyRequestCode);
            var intake = await IntakeAsync(customerCode, deviceCode, now);
            var channel = command.Channel ?? (command.WarrantyRequestCode is null ? Channel.COUNTER : Channel.ONLINE_REQUEST);
            var ticket = new Ticket(
                await codes.NextAsync(BusinessCodeType.Ticket), receptionist.StationCode, now, channel, command.RequestType ?? RequestType.WARRANTY,
                command.WarrantyRequestCode, customerCode, intake.Customer, deviceCode, intake.Device, actor.EmployeeId!, intake.Warranty,
                command.SealCondition, command.Cosmetic, command.ReportedIssue, command.PromisedReturnAt, command.EstimatedCost ?? 0,
                command.SlaLevel ?? SlaLevel.STANDARD_48H, actor);
            await tickets.SaveAsync(ticket);
            if (command.WarrantyRequestCode is not null)
                await warrantyRequests.ConvertAsync(command.WarrantyRequestCode, ticket.Id, actor.EmployeeId, now);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "TICKET_CREATED", "Tạo phiếu tiếp nhận", "TICKET", ticket.Id,
                command.WarrantyRequestCode, ticket.Id + " — Chưa phân công");
            await notifications.ForRoleAsync("DISPATCHER", "TICKET_RECEIVED", $"Phiếu {ticket.Id} mới tiếp nhận, chờ phân công.", "/dispatch", ticket.Id);
            await notifications.ForCustomerAsync(customerCode, "TICKET_RECEIVED", $"Đã tiếp nhận thiết bị. Mã phiếu {ticket.Id}.", ticket.Id);
            return await views.ViewAsync(ticket, actor);
        });
    }

    private async Task<string> CustomerCodeAsync(CustomerInput? input)
    {
        if (input is null) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        if (!string.IsNullOrWhiteSpace(input.Code)) return input.Code;
        var value = input.NewCustomer ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return (await customers.CreateAsync(value.FullName, value.Phone, value.Email, value.Address)).Code;
    }

    private async Task<string> DeviceCodeAsync(DeviceInput? input, string customerCode)
    {
        if (input is null) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        if (!string.IsNullOrWhiteSpace(input.Code)) return input.Code;
        var value = input.NewDevice ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return (await devices.RegisterAsync(new RegisterDeviceRequest(customerCode, value.ProductId, value.IdentifierType, value.SerialOrImei,
            value.WarrantyActivatedOn, value.WarrantyExpiresOn, value.Distributor))).Code;
    }

    /// <summary>Khách còn hoạt động, thiết bị thuộc khách, tình trạng bảo hành lúc nhận (SqlReceptionDirectory).</summary>
    private async Task<(Dictionary<string, string> Customer, Dictionary<string, string> Device, WarrantyAtIntake Warranty)> IntakeAsync(
        string customerCode, string deviceCode, DateTimeOffset receivedAt)
    {
        var customer = await sql.FirstOrDefaultAsync(
            "SELECT HoTen, SDT, Email, DiaChi FROM KhachHang WHERE MaKH = ? AND TrangThai = 'ACTIVE'",
            row =>
            {
                var snapshot = new Dictionary<string, string> { ["fullName"] = row.Str("HoTen")!, ["phone"] = row.Str("SDT")! };
                if (row.Str("Email") is { } email) snapshot["email"] = email;
                if (row.Str("DiaChi") is { } address) snapshot["address"] = address;
                return snapshot;
            },
            customerCode) ?? throw new DomainException(ErrorCode.CUSTOMER_NOT_FOUND);
        var device = await sql.FirstOrDefaultAsync(
            "SELECT MaSP, MaKH, LoaiDinhDanh, SoSerial_IMEI, NgayKichHoatBaoHanh, NgayHetHanBaoHanh, NhaPhanPhoi FROM ThietBi WHERE MaThietBi = ?",
            row => (ProductId: row.Str("MaSP")!, CustomerId: row.Str("MaKH"), IdentifierType: row.Str("LoaiDinhDanh"), Serial: row.Str("SoSerial_IMEI"),
                ActivatedOn: row.Date("NgayKichHoatBaoHanh"), ExpiresOn: row.Date("NgayHetHanBaoHanh"), Distributor: row.Str("NhaPhanPhoi")),
            deviceCode);
        if (device.ProductId is null) throw new DomainException(ErrorCode.DEVICE_NOT_FOUND);
        if (customerCode != device.CustomerId) throw new DomainException(ErrorCode.DEVICE_NOT_OWNED);
        var product = await catalog.RequireProductAsync(device.ProductId);
        var date = DbTime.Date(receivedAt);
        var status = device.ExpiresOn is not { } expires ? "NOT_ACTIVATED" : expires < date ? "OUT_OF_WARRANTY" : "IN_WARRANTY";
        var snapshot = new (string Key, string? Value)[]
            {
                ("productId", device.ProductId), ("productName", product.Snapshot["name"]), ("brandId", product.Snapshot["brandId"]),
                ("brandName", product.Snapshot["brandName"]), ("categoryCode", product.Snapshot["categoryCode"]),
                ("deviceTypeCode", product.Snapshot["deviceTypeCode"]), ("deviceTypeName", product.Snapshot["deviceTypeName"]),
                ("identifierType", device.IdentifierType), ("serialOrImei", device.Serial),
            }
            .Where(pair => pair.Value is not null)
            .ToDictionary(pair => pair.Key, pair => pair.Value!);
        return (customer, snapshot,
            new WarrantyAtIntake(status, device.ActivatedOn, device.ExpiresOn, device.Distributor, product.Conditions, product.PolicyId));
    }
}

public sealed class AssignmentService(
    TicketStore tickets, StaffDirectory staff, CodeGenerator codes, CurrentActor actors, TransactionRunner transactions, AuditService audit,
    NotificationService notifications, TicketQueryService views, TimeProvider clock)
{
    public Task<TicketView> AssignAsync(string ticketCode, string technicianId, Priority? priority, string? note)
    {
        actors.Require(Permission.TICKET_ASSIGN);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.DISPATCHER);
            var technician = await staff.RequireActiveWithRoleAsync(technicianId, Role.TECHNICIAN);
            var ticket = await views.RequireAsync(ticketCode);
            ticket.Assign(await codes.NextAsync(BusinessCodeType.Assignment), await codes.NextAsync(BusinessCodeType.RepairOrder), actor.EmployeeId!,
                technicianId, priority, note, clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "TICKET_ASSIGNED", "Phân công kỹ thuật viên", "TICKET", ticketCode,
                "Chưa phân công", technician.FullName);
            await notifications.ForAccountAsync(technician.AccountId, "TICKET_ASSIGNED", $"Bạn được giao phiếu {ticketCode}.", "/technician", ticketCode);
            return await views.ViewAsync(ticket, actor);
        });
    }

    public Task<TicketView> ReassignAsync(string ticketCode, string technicianId, string? note)
    {
        actors.Require(Permission.TICKET_REASSIGN);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.DISPATCHER);
            var technician = await staff.RequireActiveWithRoleAsync(technicianId, Role.TECHNICIAN);
            var ticket = await views.RequireAsync(ticketCode);
            var previous = ticket.Reassign(actor.EmployeeId!, technicianId, note, clock.GetUtcNow());
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "TICKET_REASSIGNED", "Đổi kỹ thuật viên phụ trách", "TICKET",
                ticketCode, previous, technician.FullName);
            await notifications.ForAccountAsync(technician.AccountId, "TICKET_ASSIGNED", $"Bạn được giao phiếu {ticketCode}.", "/technician", ticketCode);
            return await views.ViewAsync(ticket, actor);
        });
    }
}

public sealed class InspectionService(
    TicketStore tickets, TicketQueryService views, Sql sql, StaffDirectory staff, CodeGenerator codes, CurrentActor actors,
    TransactionRunner transactions, AuditService audit, TimeProvider clock)
{
    public Task<TicketView> RecordAsync(string ticketCode, InspectionInput input)
    {
        actors.Require(Permission.TICKET_DIAGNOSE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await TechnicianAsync();
            var ticket = await views.RequireAsync(ticketCode);
            ticket.RecordInspection(await codes.NextAsync(BusinessCodeType.Inspection), input, DbTime.Date(ticket.ReceivedAt), clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await AuditAsync(actor, ticketCode, "INSPECTION_RECORDED", "Lưu kết quả kiểm tra", null, Summary(ticket));
            return await views.ViewAsync(ticket, actor);
        });
    }

    public Task<TicketView> ReviseAsync(string ticketCode, InspectionInput input)
    {
        actors.Require(Permission.TICKET_DIAGNOSE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await TechnicianAsync();
            var ticket = await views.RequireAsync(ticketCode);
            if (await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuBaoGia WHERE MaPhieuTN = ? AND TrangThaiDuyetNoiBo <> 'REJECTED'", ticketCode) is not null
                || await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuXuatKho WHERE MaPhieuTN = ?", ticketCode) is not null)
                throw new DomainException(ErrorCode.RECLASS_NOT_ALLOWED);
            var before = Summary(ticket);
            ticket.ReviseInspection(input, DbTime.Date(ticket.ReceivedAt), clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await AuditAsync(actor, ticketCode, "INSPECTION_REVISED", "Sửa lại phân loại", before, Summary(ticket));
            return await views.ViewAsync(ticket, actor);
        });
    }

    private async Task<AuthenticatedActor> TechnicianAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.TECHNICIAN);
        return actor;
    }

    private static string? Summary(Ticket ticket) => ticket.Inspection is { } inspection ? inspection.Code + " — " + inspection.Classification : null;

    private Task AuditAsync(AuthenticatedActor actor, string ticketCode, string action, string label, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "TICKET", ticketCode, before, after);
}

public sealed class RepairService(
    TicketStore tickets, TicketQueryService views, Sql sql, StaffDirectory staff, CurrentActor actors, TransactionRunner transactions,
    AuditService audit, CodeGenerator codes, NotificationService notifications, TimeProvider clock)
{
    public Task<TicketView> StartFreeRepairAsync(string ticketCode)
    {
        actors.Require(Permission.TICKET_REPAIR);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.TECHNICIAN);
            var ticket = await views.RequireAsync(ticketCode);
            ticket.StartFreeRepair(clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "REPAIR_STARTED", "Bắt đầu sửa chữa miễn phí", "TICKET",
                ticketCode, "DIAGNOSED", "REPAIRING");
            return await views.ViewAsync(ticket, actor);
        });
    }

    public Task<TicketView> ConfirmPartsReadyAsync(string ticketCode)
    {
        actors.Require(Permission.TICKET_REPAIR, Permission.TICKET_ASSIGN);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, actor.Permissions.Contains(Permission.TICKET_REPAIR) ? Role.TECHNICIAN : Role.DISPATCHER);
            var ticket = await views.RequireAsync(ticketCode);
            if (ticket.ActiveQuotationId is null || !await CanConfirmPartsReadyAsync(ticketCode, ticket.ActiveQuotationId))
                throw new DomainException(ErrorCode.PARTS_READY_NOT_ALLOWED);
            ticket.ConfirmPartsReady(clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "PARTS_READY_CONFIRMED", "Xác nhận linh kiện ngoài kho đã sẵn sàng",
                "TICKET", ticketCode, "AWAITING_PARTS", "REPAIRING");
            return await views.ViewAsync(ticket, actor);
        });
    }

    /// <summary>BR-27: KCS Đạt → phiếu "Hoàn thành"; Chưa đạt → giữ "Đang sửa chữa" và lưu lần thử.</summary>
    public Task<TicketView> RecordResultAsync(string ticketCode, RepairResultRequest command)
    {
        actors.Require(Permission.TICKET_REPAIR);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.TECHNICIAN);
            var ticket = await views.RequireAsync(ticketCode);
            var before = ticket.Status;
            ticket.RecordRepairResult(await codes.NextAsync(BusinessCodeType.RepairResult), command.WorkDone, command.QcSteps, command.QcResult,
                command.QcDetails, clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, "REPAIR_RESULT_RECORDED", "Ghi kết quả sửa chữa và KCS", "TICKET",
                ticketCode, ticketCode + " — " + before.SqlLabel(), $"{ticketCode} — {ticket.Status.SqlLabel()} (KCS {command.QcResult})");
            if (ticket.Status == TicketStatus.COMPLETED)
            {
                var message = $"Phiếu {ticketCode} đã hoàn tất sửa chữa, sẵn sàng bàn giao.";
                foreach (var role in new[] { Role.CASHIER, Role.RECEPTIONIST })
                    await notifications.ForRoleAsync(role.ToString(), "TICKET_COMPLETED", message, "/cashier#" + ticketCode, ticketCode);
                await notifications.ForCustomerAsync(ticket.CustomerId, "TICKET_COMPLETED",
                    $"Thiết bị của phiếu {ticketCode} đã sửa xong, sẵn sàng nhận máy tại trung tâm.", ticketCode);
            }
            return await views.ViewAsync(ticket, actor);
        });
    }

    /// <summary>D-006: báo giá khách đã đồng ý chỉ gồm hàng đặt riêng (không mã LK) và không còn phiếu xuất đang chờ.</summary>
    private async Task<bool> CanConfirmPartsReadyAsync(string ticketCode, string quotationCode) =>
        await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuBaoGia WHERE MaBaoGia = ? AND MaPhieuTN = ? AND TrangThaiDuyetNoiBo = 'APPROVED' AND KhachXacNhan = 'ACCEPTED'",
            quotationCode, ticketCode) is not null
        && await sql.ScalarAsync("SELECT TOP 1 1 FROM ChiTietBaoGia WHERE MaBaoGia = ? AND MaLK IS NOT NULL AND TRIM(MaLK) <> ''", quotationCode) is null
        && await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuXuatKho WHERE MaPhieuTN = ? AND TrangThai = 'PENDING'", ticketCode) is null;
}

public sealed record RepairResultRequest([NotBlank] string WorkDone, [NotNull, Size(6, 6)] List<QcStep?>? QcSteps, [NotBlank] string QcResult, string? QcDetails);

public sealed class TicketNoteService(
    TicketStore tickets, TicketQueryService views, StaffDirectory staff, CurrentActor actors, TransactionRunner transactions, AuditService audit, TimeProvider clock)
{
    public Task<TicketView> AddCustomerNoteAsync(string ticketCode, string text)
    {
        actors.Require(Permission.TICKET_NOTE_CUSTOMER);
        return AddAsync(ticketCode, text, internalNote: false);
    }

    public Task<TicketView> AddInternalNoteAsync(string ticketCode, string text)
    {
        actors.Require(Permission.TICKET_NOTE_INTERNAL);
        return AddAsync(ticketCode, text, internalNote: true);
    }

    private Task<TicketView> AddAsync(string ticketCode, string text, bool internalNote) =>
        transactions.InTransactionAsync(async () =>
        {
            var actor = actors.Current;
            var ticket = await views.RequireAsync(ticketCode);
            await RequireStaffAndScopeAsync(actor, ticket);
            if (internalNote) ticket.AddInternalNote(text, clock.GetUtcNow(), actor);
            else ticket.AddCustomerNote(text, clock.GetUtcNow(), actor);
            await tickets.SaveAsync(ticket);
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames,
                internalNote ? "TICKET_INTERNAL_NOTE_ADDED" : "TICKET_CUSTOMER_NOTE_ADDED",
                internalNote ? "Thêm ghi chú nội bộ" : "Thêm ghi chú cho khách", "TICKET", ticketCode, null, text);
            return await views.ViewAsync(ticket, actor);
        });

    private async Task RequireStaffAndScopeAsync(AuthenticatedActor actor, Ticket ticket)
    {
        if (actor.Roles.Contains(Role.DISPATCHER))
        {
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.DISPATCHER);
            return;
        }
        if (actor.Roles.Contains(Role.RECEPTIONIST))
        {
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.RECEPTIONIST);
            return;
        }
        if (actor.Roles.Contains(Role.TECHNICIAN))
        {
            await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.TECHNICIAN);
            if (ticket.Assignment?.TechnicianId != actor.EmployeeId) throw new DomainException(ErrorCode.NOT_ASSIGNED_TECHNICIAN);
            return;
        }
        throw new DomainException(ErrorCode.ACCESS_DENIED);
    }
}
