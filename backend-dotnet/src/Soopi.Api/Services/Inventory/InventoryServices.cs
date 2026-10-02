using System.Text.Json.Serialization;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Inventory;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Tickets;

namespace Soopi.Api.Services.Inventory;

/// <summary>Như @JsonInclude(NON_NULL) của Java: trường null bị bỏ khỏi JSON (giá vốn khi không có quyền xem).</summary>
public sealed record PartView(
    string Sku, string Name, string? Unit, string? CategoryCode, string? BrandName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] decimal? CostPrice,
    decimal ServicePrice, int OnHand, int Reserved, int Available, int MinLevel, bool LowStock,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? LowStockReason,
    string PrimaryBin, IReadOnlyList<Bin> Bins, int WarrantyMonths,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SupplierId,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SupplierName,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SupplierPhone,
    bool Active)
{
    public static PartView From(PartStock part, bool showCost)
    {
        var low = part.Available <= part.MinLevel;
        return new PartView(part.Sku, part.Name, part.Unit, part.CategoryCode, part.BrandName, showCost ? part.CostPrice : null, part.ServicePrice,
            part.OnHand, part.Reserved, part.Available, part.MinLevel, low, low ? $"Tồn khả dụng {part.Available} ≤ mức tối thiểu {part.MinLevel}" : null,
            part.PrimaryBin, part.Bins, part.WarrantyMonths, part.SupplierId, part.SupplierName, part.SupplierPhone, part.Active);
    }
}

public sealed record IssueLineView(
    string Sku, int Quantity,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] decimal? UnitCost,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? BinCode,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateOnly? PartWarrantyExpiresOn);

/// <summary>Như @JsonInclude(NON_NULL) của Java.</summary>
public sealed record IssueView(
    string Code, string TicketCode, string Source,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? QuotationCode,
    string Reason, string TechnicianId,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? TechnicianName,
    string RequestedBy, DateTimeOffset RequestedAt, string Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ProcessedBy,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTimeOffset? ProcessedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RejectedReason,
    IReadOnlyList<IssueLineView> Lines,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] decimal? TotalCost)
{
    public static IssueView From(StockIssue value, bool showCost, string? technicianName) =>
        new(value.Id, value.TicketId, value.Source, value.QuotationId, value.Reason, value.TechnicianId, technicianName, value.RequestedBy,
            value.RequestedAt, value.Status, value.ProcessedBy, value.ProcessedAt, value.RejectedReason,
            value.Lines.Select(line => new IssueLineView(line.Sku, line.Quantity, showCost ? line.UnitCost : null, line.BinCode, line.PartWarrantyExpiresOn)).ToList(),
            showCost ? value.TotalCost : null);
}

public sealed record StockReceiptView(
    string Code, string SupplierId, string? BatchNo, DateOnly ReceivedOn, string Status, string RequestedBy, string? Note,
    IReadOnlyList<ReceiptLine> Lines, decimal TotalCost, string? ProcessedBy, DateTimeOffset? ProcessedAt, string? RejectedReason)
{
    public static StockReceiptView From(StockReceipt r) =>
        new(r.Id, r.SupplierId, r.BatchNo, r.ReceivedOn, r.Status, r.RequestedBy, r.Note, r.Lines, r.TotalCost, r.ProcessedBy, r.ProcessedAt, r.RejectedReason);
}

public sealed record TransferView(
    string Code, string Sku, int Quantity, string FromBin, string ToBin, string Reason, string Status, string RequestedBy, string? ProcessedBy,
    DateTimeOffset? ProcessedAt, string? RejectedReason)
{
    public static TransferView From(StockTransfer t) =>
        new(t.Id, t.Sku, t.Quantity, t.FromBin, t.ToBin, t.Reason, t.Status, t.RequestedBy, t.ProcessedBy, t.ProcessedAt, t.RejectedReason);
}

public sealed record Deduction(string Sku, string Name, int Quantity, string BinCode);

public sealed record ApprovalView(IssueView Issue, IReadOnlyList<Deduction> Deductions);

public sealed record IssueLineRequest([NotBlank] string Sku, [Positive] int Quantity);

public sealed record IssueRequest([NotBlank] string TicketCode, string? QuotationCode, List<IssueLineRequest?>? Lines, string? Reason);

public sealed record LineBinRequest([NotBlank] string Sku, [NotBlank] string BinCode);

public sealed record ApproveIssueRequest(List<LineBinRequest>? LineBins);

public sealed record ReasonRequest([NotBlank] string Reason);

public sealed record ReceiptLineRequest([NotBlank] string Sku, [Positive] int Quantity, [NotNull, PositiveOrZero] decimal? UnitCost, string? SerialBatch, string? BinCode);

public sealed record ReceiptRequest([NotBlank] string SupplierId, string? BatchNo, DateOnly? ReceivedOn, string? Note, [NotEmpty] List<ReceiptLineRequest>? Lines);

public sealed record ReceiptLinesRequest([NotEmpty] List<ReceiptLineRequest>? Lines);

public sealed record TransferRequest([NotBlank] string Sku, [Positive] int Quantity, [NotBlank] string FromBin, [NotBlank] string ToBin, [NotBlank] string Reason);

public sealed class PartQueryService(InventoryStore inventory, CurrentActor actors)
{
    public async Task<List<PartView>> ListAsync(string? query, string? category, bool lowStock)
    {
        var showCost = actors.Require(Permission.INVENTORY_READ).Permissions.Contains(Permission.INVENTORY_READ_COST);
        return (await inventory.FindPartsAsync(query, category, lowStock)).Select(part => PartView.From(part, showCost)).ToList();
    }

    public async Task<PartView> GetAsync(string sku)
    {
        var actor = actors.Require(Permission.INVENTORY_READ);
        return PartView.From(await inventory.RequirePartAsync(sku), actor.Permissions.Contains(Permission.INVENTORY_READ_COST));
    }
}

/// <summary>Nhắc tồn thấp cho kho sau khi xuất/nhập.</summary>
public sealed class LowStockNotifier(InventoryStore inventory, NotificationService notifications)
{
    public async Task CheckAsync(string sku)
    {
        var part = await inventory.RequirePartAsync(sku);
        if (part.Available <= part.MinLevel)
            await notifications.ForRoleAsync("WAREHOUSE_KEEPER", "LOW_STOCK",
                $"● Tồn thấp: {part.Name} — tồn khả dụng {part.Available} ≤ mức tối thiểu {part.MinLevel}", "/warehouse#parts", sku);
    }
}

public sealed class StockIssueService(
    InventoryDocumentStore documents, InventoryStore inventory, QuotationStore quotations, TicketStore tickets, TicketQueryService ticketViews,
    StaffDirectory staff, CodeGenerator codes, CurrentActor actors, TransactionRunner transactions, AuditService audit,
    NotificationService notifications, LowStockNotifier lowStock, TimeProvider clock)
{
    // ponytail: xếp hàng giữ tồn trong một tiến trình như synchronized của Java; nhiều máy chủ thì dựa vào UPDATE có điều kiện.
    private static readonly SemaphoreSlim ReservationMonitor = new(1, 1);

    public async Task<IssueView> RequestAsync(IssueRequest command)
    {
        actors.Require(Permission.STOCK_ISSUE_REQUEST);
        var code = await codes.NextAsync(BusinessCodeType.StockIssue);
        await ReservationMonitor.WaitAsync();
        try
        {
            return await transactions.InTransactionAsync(async () =>
            {
                var actor = await RequesterAsync();
                var ticket = await ticketViews.RequireAsync(command.TicketCode);
                RequireAssigned(ticket, actor);
                var hasQuotation = !string.IsNullOrWhiteSpace(command.QuotationCode);
                var hasLines = command.Lines is { Count: > 0 };
                if (hasQuotation == hasLines) throw new DomainException(ErrorCode.STOCK_ISSUE_SOURCE_REQUIRED);
                if (await documents.HasPendingIssueAsync(ticket.Id)) throw new DomainException(ErrorCode.STOCK_ISSUE_PENDING_EXISTS);
                var quantities = hasQuotation ? await QuotationLinesAsync(command.QuotationCode!, ticket) : FreeLines(command.Lines!, ticket, actor);
                var lines = await ReserveLinesAsync(quantities);
                var issue = new StockIssue(code, ticket.Id, hasQuotation ? "QUOTATION" : "FREE_WARRANTY", hasQuotation ? command.QuotationCode!.Trim() : null,
                    hasQuotation ? "Xuất thay thế sửa chữa" : "Xuất bảo hành miễn phí", ticket.Assignment!.TechnicianId, actor.EmployeeId!,
                    clock.GetUtcNow(), lines);
                await documents.SaveAsync(issue);
                if (!hasQuotation) await tickets.SaveAsync(ticket);
                await AuditAsync(actor, "STOCK_ISSUE_REQUESTED", "Gửi yêu cầu xuất kho", code, null, ticket.Id);
                await notifications.ForRoleAsync("WAREHOUSE_KEEPER", "STOCK_ISSUE_PENDING", $"Yêu cầu xuất kho {code} đang chờ xử lý.", "/warehouse#stockout", code);
                return IssueView.From(issue, actor.Permissions.Contains(Permission.INVENTORY_READ_COST), await TechnicianNameAsync(issue));
            });
        }
        finally
        {
            ReservationMonitor.Release();
        }
    }

    public Task<ApprovalView> ApproveAsync(string code, IReadOnlyDictionary<string, string> requestedBins)
    {
        actors.Require(Permission.STOCK_ISSUE_PROCESS);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var issue = await RequireIssueAsync(code);
            if (issue.Status != "PENDING") throw new DomainException(ErrorCode.STOCK_ISSUE_NOT_PENDING);
            var ticket = await ticketViews.RequireAsync(issue.TicketId);
            if (ticket.Status != TicketStatus.AWAITING_PARTS) throw new DomainException(ErrorCode.TICKET_INVALID_STATE);
            var bins = new Dictionary<string, string>();
            var deductions = new List<Deduction>();
            foreach (var line in issue.Lines.OrderBy(line => line.Sku, StringComparer.Ordinal))
            {
                var part = await inventory.RequirePartAsync(line.Sku);
                var bin = requestedBins.GetValueOrDefault(line.Sku);
                if (string.IsNullOrWhiteSpace(bin)) bin = part.PrimaryBin;
                await inventory.IssueAsync(line.Sku, line.Quantity, bin);
                bins[line.Sku] = bin;
                deductions.Add(new Deduction(line.Sku, part.Name, line.Quantity, bin));
                await lowStock.CheckAsync(line.Sku);
            }
            var now = clock.GetUtcNow();
            issue.Issue(actor.EmployeeId!, now, bins);
            ticket.StartRepairWithIssuedParts(now, actor);
            await documents.SaveAsync(issue);
            await tickets.SaveAsync(ticket);
            await AuditAsync(actor, "STOCK_ISSUE_APPROVED", "Duyệt và thực xuất kho", code, "PENDING", "ISSUED");
            await notifications.ForEmployeeAsync(issue.TechnicianId, "STOCK_ISSUE_APPROVED", $"Yêu cầu xuất kho {code} đã được duyệt.",
                "/technician#" + issue.TicketId, code);
            return new ApprovalView(IssueView.From(issue, true, await TechnicianNameAsync(issue)), deductions);
        });
    }

    public Task<IssueView> RejectAsync(string code, string reason)
    {
        actors.Require(Permission.STOCK_ISSUE_PROCESS);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var issue = await RequireIssueAsync(code);
            if (issue.Status != "PENDING") throw new DomainException(ErrorCode.STOCK_ISSUE_NOT_PENDING);
            foreach (var line in issue.Lines.OrderBy(line => line.Sku, StringComparer.Ordinal)) await inventory.ReleaseAsync(line.Sku, line.Quantity);
            issue.Reject(actor.EmployeeId!, reason, clock.GetUtcNow());
            await documents.SaveAsync(issue);
            await AuditAsync(actor, "STOCK_ISSUE_REJECTED", "Từ chối yêu cầu xuất kho", code, "PENDING", "REJECTED");
            await notifications.ForEmployeeAsync(issue.TechnicianId, "STOCK_ISSUE_REJECTED", $"Yêu cầu xuất kho {code} bị từ chối.",
                "/technician#" + issue.TicketId, code);
            return IssueView.From(issue, true, await TechnicianNameAsync(issue));
        });
    }

    public async Task<List<IssueView>> ListAsync(string? status)
    {
        actors.Require(Permission.STOCK_ISSUE_PROCESS);
        var names = await staff.EmployeeNamesAsync();
        return (await documents.FindIssuesAsync(status, null)).Select(issue => IssueView.From(issue, true, names.GetValueOrDefault(issue.TechnicianId))).ToList();
    }

    public async Task<List<IssueView>> MineAsync(string? status)
    {
        var actor = actors.Require(Permission.STOCK_ISSUE_REQUEST);
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.TECHNICIAN);
        var names = await staff.EmployeeNamesAsync();
        return (await documents.FindIssuesAsync(status, actor.EmployeeId)).Select(issue => IssueView.From(issue, false, names.GetValueOrDefault(issue.TechnicianId))).ToList();
    }

    private async Task<Dictionary<string, int>> QuotationLinesAsync(string quotationCode, Ticket ticket)
    {
        if (ticket.Status != TicketStatus.AWAITING_PARTS) throw new DomainException(ErrorCode.TICKET_INVALID_STATE);
        var quotation = await quotations.FindAsync(quotationCode.Trim());
        if (quotation is null || quotation.TicketId != ticket.Id || quotation.Approval.Status != "APPROVED" || quotation.CustomerDecision.Status != "ACCEPTED")
            throw new DomainException(ErrorCode.STOCK_ISSUE_QUOTE_MISMATCH);
        var result = new Dictionary<string, int>();
        foreach (var line in quotation.Lines.Where(line => line.Sku is not null))
            result[line.Sku!] = result.GetValueOrDefault(line.Sku!) + line.Quantity;
        return result.Count == 0 ? throw new DomainException(ErrorCode.STOCK_ISSUE_NO_LINES) : result;
    }

    private Dictionary<string, int> FreeLines(List<IssueLineRequest?> input, Ticket ticket, AuthenticatedActor actor)
    {
        ticket.RequestFreeParts(clock.GetUtcNow(), actor);
        var result = new Dictionary<string, int>();
        foreach (var line in input)
        {
            if (line is null || string.IsNullOrWhiteSpace(line.Sku) || line.Quantity <= 0) throw new DomainException(ErrorCode.STOCK_ISSUE_PART_INVALID);
            result[line.Sku.Trim()] = result.GetValueOrDefault(line.Sku.Trim()) + line.Quantity;
        }
        return result.Count == 0 ? throw new DomainException(ErrorCode.STOCK_ISSUE_NO_LINES) : result;
    }

    private async Task<List<IssueLine>> ReserveLinesAsync(Dictionary<string, int> quantities)
    {
        var result = new List<IssueLine>();
        foreach (var (sku, quantity) in quantities.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var part = await inventory.RequirePartAsync(sku);
            if (quantity <= 0) throw new DomainException(ErrorCode.STOCK_ISSUE_PART_INVALID);
            await inventory.ReserveAsync(part.Sku, quantity);
            result.Add(new IssueLine(part.Sku, quantity, part.CostPrice, null, null));
        }
        return result;
    }

    private async Task<AuthenticatedActor> RequesterAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, actor.Roles.Contains(Role.WAREHOUSE_KEEPER) ? Role.WAREHOUSE_KEEPER : Role.TECHNICIAN);
        return actor;
    }

    private async Task<AuthenticatedActor> WarehouseAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.WAREHOUSE_KEEPER);
        return actor;
    }

    private static void RequireAssigned(Ticket ticket, AuthenticatedActor actor)
    {
        if (ticket.Assignment is null || (!actor.Roles.Contains(Role.WAREHOUSE_KEEPER) && actor.EmployeeId != ticket.Assignment.TechnicianId))
            throw new DomainException(ErrorCode.NOT_ASSIGNED_TECHNICIAN);
    }

    private async Task<StockIssue> RequireIssueAsync(string code) => await documents.FindIssueAsync(code) ?? throw new DomainException(ErrorCode.STOCK_ISSUE_NOT_PENDING);

    private async Task<string?> TechnicianNameAsync(StockIssue issue) => (await staff.EmployeeNamesAsync()).GetValueOrDefault(issue.TechnicianId);

    private Task AuditAsync(AuthenticatedActor actor, string action, string label, string entityId, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "STOCK_ISSUE", entityId, before, after);
}

public sealed class StockReceiptService(
    InventoryDocumentStore documents, InventoryStore inventory, StaffDirectory staff, CodeGenerator codes, CurrentActor actors,
    TransactionRunner transactions, AuditService audit, LowStockNotifier lowStock, TimeProvider clock)
{
    public Task<StockReceiptView> CreateAsync(ReceiptRequest command)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            if (!await inventory.SupplierExistsAsync(command.SupplierId)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
            var receipt = new StockReceipt(await codes.NextAsync(BusinessCodeType.StockReceipt), command.SupplierId, command.BatchNo,
                command.ReceivedOn ?? DbTime.Date(clock.GetUtcNow()), actor.EmployeeId!, command.Note, await LinesAsync(command.Lines));
            await documents.SaveAsync(receipt);
            await AuditAsync(actor, "STOCK_RECEIPT_CREATED", "Tạo phiếu nhập kho", receipt.Id, null, "PENDING");
            return StockReceiptView.From(receipt);
        });
    }

    public Task<StockReceiptView> UpdateLinesAsync(string code, List<ReceiptLineRequest>? lines)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var receipt = await RequireAsync(code);
            if (actor.EmployeeId != receipt.RequestedBy) throw new DomainException(ErrorCode.STOCK_RECEIPT_CONFLICT);
            receipt.UpdateLines(await LinesAsync(lines));
            await documents.SaveAsync(receipt);
            await AuditAsync(actor, "STOCK_RECEIPT_UPDATED", "Cập nhật phiếu nhập kho", code, null, "PENDING");
            return StockReceiptView.From(receipt);
        });
    }

    public Task<StockReceiptView> ApproveAsync(string code)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var receipt = await RequireAsync(code);
            if (receipt.Status != "PENDING") throw new DomainException(ErrorCode.STOCK_DOC_NOT_PENDING);
            foreach (var line in receipt.Lines.OrderBy(line => line.Sku, StringComparer.Ordinal))
            {
                var part = await inventory.RequirePartAsync(line.Sku);
                await inventory.ReceiveAsync(line.Sku, line.Quantity, line.BinCode ?? part.PrimaryBin);
            }
            receipt.Approve(actor.EmployeeId!, clock.GetUtcNow());
            await documents.SaveAsync(receipt);
            await AuditAsync(actor, "STOCK_RECEIPT_APPROVED", "Duyệt và thực nhập kho", code, "PENDING", "APPROVED");
            foreach (var line in receipt.Lines) await lowStock.CheckAsync(line.Sku);
            return StockReceiptView.From(receipt);
        });
    }

    public Task<StockReceiptView> RejectAsync(string code, string reason)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var receipt = await RequireAsync(code);
            receipt.Reject(actor.EmployeeId!, reason, clock.GetUtcNow());
            await documents.SaveAsync(receipt);
            await AuditAsync(actor, "STOCK_RECEIPT_REJECTED", "Từ chối phiếu nhập kho", code, "PENDING", "REJECTED");
            return StockReceiptView.From(receipt);
        });
    }

    public async Task<List<StockReceiptView>> ListAsync(string? status)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        return (await documents.FindReceiptsAsync(status)).Select(StockReceiptView.From).ToList();
    }

    public async Task<StockReceiptView> GetAsync(string code)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        await WarehouseAsync();
        return StockReceiptView.From(await RequireAsync(code));
    }

    private async Task<List<ReceiptLine?>> LinesAsync(List<ReceiptLineRequest>? input)
    {
        if (input is null || input.Count == 0) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var result = new List<ReceiptLine?>();
        foreach (var line in input)
        {
            if (line?.Sku is null) throw new DomainException(ErrorCode.VALIDATION_FAILED);
            await inventory.RequirePartAsync(line.Sku.Trim());
            result.Add(ReceiptLine.Of(line.Sku.Trim(), line.Quantity, line.UnitCost, line.SerialBatch, line.BinCode));
        }
        return result;
    }

    private async Task<StockReceipt> RequireAsync(string code) => await documents.FindReceiptAsync(code) ?? throw new DomainException(ErrorCode.NOT_FOUND);

    private async Task<AuthenticatedActor> WarehouseAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.WAREHOUSE_KEEPER);
        return actor;
    }

    private Task AuditAsync(AuthenticatedActor actor, string action, string label, string entityId, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "STOCK_RECEIPT", entityId, before, after);
}

public sealed class StockTransferService(
    InventoryDocumentStore documents, InventoryStore inventory, StaffDirectory staff, CodeGenerator codes, CurrentActor actors,
    TransactionRunner transactions, AuditService audit, TimeProvider clock)
{
    public Task<TransferView> CreateAsync(TransferRequest command)
    {
        actors.Require(Permission.STOCK_TRANSFER_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            await inventory.RequirePartAsync(command.Sku);
            var transfer = new StockTransfer(await codes.NextAsync(BusinessCodeType.StockTransfer), command.Sku, command.Quantity, command.FromBin,
                command.ToBin, command.Reason, actor.EmployeeId!);
            await documents.SaveAsync(transfer);
            await AuditAsync(actor, "STOCK_TRANSFER_CREATED", "Tạo phiếu điều chuyển", transfer.Id, null, "PENDING");
            return TransferView.From(transfer);
        });
    }

    public Task<TransferView> ApproveAsync(string code)
    {
        actors.Require(Permission.STOCK_TRANSFER_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var transfer = await RequireAsync(code);
            await inventory.TransferAsync(transfer.Sku, transfer.Quantity, transfer.FromBin, transfer.ToBin);
            transfer.Approve(actor.EmployeeId!, clock.GetUtcNow());
            await documents.SaveAsync(transfer);
            await AuditAsync(actor, "STOCK_TRANSFER_APPROVED", "Duyệt điều chuyển", code, "PENDING", "COMPLETED");
            return TransferView.From(transfer);
        });
    }

    public Task<TransferView> RejectAsync(string code, string reason)
    {
        actors.Require(Permission.STOCK_TRANSFER_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var transfer = await RequireAsync(code);
            transfer.Reject(actor.EmployeeId!, reason, clock.GetUtcNow());
            await documents.SaveAsync(transfer);
            await AuditAsync(actor, "STOCK_TRANSFER_REJECTED", "Từ chối điều chuyển", code, "PENDING", "REJECTED");
            return TransferView.From(transfer);
        });
    }

    public async Task<List<TransferView>> ListAsync(string? status)
    {
        actors.Require(Permission.STOCK_TRANSFER_MANAGE);
        return (await documents.FindTransfersAsync(status)).Select(TransferView.From).ToList();
    }

    private async Task<StockTransfer> RequireAsync(string code) => await documents.FindTransferAsync(code) ?? throw new DomainException(ErrorCode.NOT_FOUND);

    private async Task<AuthenticatedActor> WarehouseAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.WAREHOUSE_KEEPER);
        return actor;
    }

    private Task AuditAsync(AuthenticatedActor actor, string action, string label, string entityId, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "STOCK_TRANSFER", entityId, before, after);
}

public sealed record IssuedPart(
    string IssueCode, string Source, string Sku, string Name, int Quantity, string? BinCode, decimal? ServicePrice, int WarrantyMonths,
    DateOnly? WarrantyExpiresOn);

/// <summary>Linh kiện đã xuất cho một phiếu: ghi hạn bảo hành khi bàn giao, liệt kê cho phiếu bàn giao/thanh toán.</summary>
public sealed class IssuedParts(InventoryDocumentStore documents, InventoryStore inventory)
{
    public async Task ApplyWarrantyAsync(string ticketCode, DateOnly handedOverOn)
    {
        foreach (var issue in await documents.FindIssuedByTicketAsync(ticketCode))
        {
            var months = new Dictionary<string, int>();
            foreach (var line in issue.Lines) months[line.Sku] = (await inventory.FindPartAsync(line.Sku))?.WarrantyMonths ?? 0;
            issue.ApplyPartWarranty(handedOverOn, months);
            await documents.SaveAsync(issue);
        }
    }

    public async Task<List<IssuedPart>> FindByTicketAsync(string ticketCode)
    {
        var result = new List<IssuedPart>();
        foreach (var issue in await documents.FindIssuedByTicketAsync(ticketCode))
        {
            foreach (var line in issue.Lines)
            {
                var part = await inventory.FindPartAsync(line.Sku);
                result.Add(new IssuedPart(issue.Id, issue.Source, line.Sku, part?.Name ?? line.Sku, line.Quantity, line.BinCode, part?.ServicePrice,
                    part?.WarrantyMonths ?? 0, line.PartWarrantyExpiresOn));
            }
        }
        return result;
    }
}
