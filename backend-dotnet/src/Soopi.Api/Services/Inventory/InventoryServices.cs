using System.Text.Json.Serialization;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Inventory;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.DTOs.Shared;
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
    public DateTimeOffset? CreatedAt { get; init; }
    public static StockReceiptView From(StockReceipt r) =>
        new(r.Id, r.SupplierId, r.BatchNo, r.ReceivedOn, r.Status, r.RequestedBy, r.Note, r.Lines, r.TotalCost, r.ProcessedBy, r.ProcessedAt, r.RejectedReason) { CreatedAt = r.CreatedAt };
}

public sealed record TransferView(
    string Code, string Sku, int Quantity, string FromBin, string ToBin, string Reason, string Status, string RequestedBy, string? ProcessedBy,
    DateTimeOffset? ProcessedAt, string? RejectedReason)
{
    public DateTimeOffset? CreatedAt { get; init; }
    public static TransferView From(StockTransfer t) =>
        new(t.Id, t.Sku, t.Quantity, t.FromBin, t.ToBin, t.Reason, t.Status, t.RequestedBy, t.ProcessedBy, t.ProcessedAt, t.RejectedReason) { CreatedAt = t.CreatedAt };
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

    public async Task<PageResponse<IssueView>> SearchAsync(InventoryDocumentFilter filter)
    {
        actors.Require(Permission.STOCK_ISSUE_PROCESS);
        var total = await documents.CountDocumentsAsync(InventoryDocumentKind.Issue, filter);
        var names = await staff.EmployeeNamesAsync();
        var items = (await documents.SearchIssuesAsync(filter)).Select(issue => IssueView.From(issue, true, names.GetValueOrDefault(issue.TechnicianId))).ToList();
        return PageResponse<IssueView>.Of(items, filter.Page, filter.Size, total);
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

    public async Task<PageResponse<StockReceiptView>> SearchAsync(InventoryDocumentFilter filter)
    {
        actors.Require(Permission.STOCK_RECEIPT_MANAGE);
        var total = await documents.CountDocumentsAsync(InventoryDocumentKind.Receipt, filter);
        var items = (await documents.SearchReceiptsAsync(filter)).Select(StockReceiptView.From).ToList();
        return PageResponse<StockReceiptView>.Of(items, filter.Page, filter.Size, total);
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

    public async Task<PageResponse<TransferView>> SearchAsync(InventoryDocumentFilter filter)
    {
        actors.Require(Permission.STOCK_TRANSFER_MANAGE);
        var total = await documents.CountDocumentsAsync(InventoryDocumentKind.Transfer, filter);
        var items = (await documents.SearchTransfersAsync(filter)).Select(TransferView.From).ToList();
        return PageResponse<TransferView>.Of(items, filter.Page, filter.Size, total);
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

public sealed record StocktakeLineView(string Sku, string Name, string BinCode, int SystemQty, int CountedQty, int Difference, string? Note);

/// <summary>Kèm số dòng lệch, tổng thừa/thiếu để danh sách và màn duyệt không phải tự tính.</summary>
public sealed record StocktakeView(
    string Code, string Scope, string? Note, string Status, string RequestedBy, DateTimeOffset? CreatedAt, string? ProcessedBy,
    DateTimeOffset? ProcessedAt, string? RejectedReason, IReadOnlyList<StocktakeLineView> Lines, int LineCount, int DiscrepancyCount, int Surplus,
    int Shortage)
{
    public static StocktakeView From(Stocktake s, IReadOnlyDictionary<string, string> names)
    {
        var lines = s.Lines.Select(line => new StocktakeLineView(line.Sku, names.GetValueOrDefault(line.Sku, line.Sku), line.BinCode, line.SystemQty,
            line.CountedQty, line.Difference, line.Note)).ToList();
        return new(s.Id, s.Scope, s.Note, s.Status, s.RequestedBy, s.CreatedAt, s.ProcessedBy, s.ProcessedAt, s.RejectedReason, lines, lines.Count,
            lines.Count(line => line.Difference != 0), lines.Where(line => line.Difference > 0).Sum(line => line.Difference),
            -lines.Where(line => line.Difference < 0).Sum(line => line.Difference));
    }
}

public sealed record StocktakeLineRequest([NotBlank] string Sku, [NotBlank] string BinCode, [NotNull, PositiveOrZero] int? CountedQty, string? Note);

public sealed record StocktakeRequest(string? Scope, [Size(0, 255)] string? Note, [NotEmpty] List<StocktakeLineRequest>? Lines);

/// <summary>
/// Kiểm kê kho: lập phiếu từ danh sách cần đếm (tồn hệ thống do máy chủ chụp lúc lập, không tin số client gửi), duyệt thì điều
/// chỉnh tồn theo chênh lệch từng dòng; từ chối phải ghi lý do.
/// </summary>
public sealed class StocktakeService(
    InventoryDocumentStore documents, InventoryStore inventory, StaffDirectory staff, CodeGenerator codes, CurrentActor actors,
    TransactionRunner transactions, AuditService audit, LowStockNotifier lowStock, TimeProvider clock)
{
    public async Task<List<StocktakeSheetRow>> SheetAsync(string? category, string? binPrefix)
    {
        actors.Require(Permission.STOCKTAKE_MANAGE);
        return await inventory.StocktakeSheetAsync(category, binPrefix);
    }

    public Task<StocktakeView> CreateAsync(StocktakeRequest command)
    {
        actors.Require(Permission.STOCKTAKE_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var lines = new List<StocktakeLine>();
            foreach (var line in command.Lines ?? [])
            {
                var sku = JavaText.Trim(line.Sku);
                if (await inventory.FindPartAsync(sku) is null) throw DomainException.Invalid($"Linh kiện \"{sku}\" không tồn tại hoặc đã ngừng dùng.");
                var bin = JavaText.Trim(line.BinCode).ToUpperInvariant();
                lines.Add(new StocktakeLine(sku, bin, await inventory.BinQuantityAsync(sku, bin), line.CountedQty!.Value, line.Note));
            }
            var stocktake = new Stocktake(await codes.NextAsync(BusinessCodeType.Stocktake), command.Scope, command.Note, lines, actor.EmployeeId!);
            await documents.SaveAsync(stocktake);
            await AuditAsync(actor, "STOCKTAKE_CREATED", "Lập phiếu kiểm kê", stocktake.Id, null, "PENDING");
            return await ViewAsync(stocktake);
        });
    }

    public Task<StocktakeView> ApproveAsync(string code)
    {
        actors.Require(Permission.STOCKTAKE_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var stocktake = await RequireAsync(code);
            stocktake.Approve(actor.EmployeeId!, clock.GetUtcNow());
            // Khóa LinhKien trước TonKhoTheoKe theo thứ tự mã như các luồng kho khác.
            foreach (var line in stocktake.Lines.Where(line => line.Difference != 0).OrderBy(line => line.Sku, StringComparer.Ordinal))
                await inventory.AdjustAsync(line.Sku, line.BinCode, line.Difference);
            await documents.SaveAsync(stocktake);
            await AuditAsync(actor, "STOCKTAKE_APPROVED", "Duyệt kiểm kê, điều chỉnh tồn", code, "PENDING", "COMPLETED");
            foreach (var sku in stocktake.Lines.Where(line => line.Difference < 0).Select(line => line.Sku).Distinct()) await lowStock.CheckAsync(sku);
            return await ViewAsync(stocktake);
        });
    }

    public Task<StocktakeView> RejectAsync(string code, string reason)
    {
        actors.Require(Permission.STOCKTAKE_MANAGE);
        return transactions.InTransactionAsync(async () =>
        {
            var actor = await WarehouseAsync();
            var stocktake = await RequireAsync(code);
            stocktake.Reject(actor.EmployeeId!, reason, clock.GetUtcNow());
            await documents.SaveAsync(stocktake);
            await AuditAsync(actor, "STOCKTAKE_REJECTED", "Từ chối phiếu kiểm kê", code, "PENDING", "REJECTED");
            return await ViewAsync(stocktake);
        });
    }

    public async Task<StocktakeView> GetAsync(string code)
    {
        actors.Require(Permission.STOCKTAKE_MANAGE);
        return await ViewAsync(await RequireAsync(code));
    }

    public async Task<PageResponse<StocktakeView>> SearchAsync(InventoryDocumentFilter filter)
    {
        actors.Require(Permission.STOCKTAKE_MANAGE);
        var total = await documents.CountDocumentsAsync(InventoryDocumentKind.Stocktake, filter);
        var names = await NamesAsync();
        var items = (await documents.SearchStocktakesAsync(filter)).Select(item => StocktakeView.From(item, names)).ToList();
        return PageResponse<StocktakeView>.Of(items, filter.Page, filter.Size, total);
    }

    private async Task<StocktakeView> ViewAsync(Stocktake stocktake) => StocktakeView.From(stocktake, await NamesAsync());

    private async Task<Dictionary<string, string>> NamesAsync() =>
        (await inventory.FindPartsAsync(null, null, false)).ToDictionary(part => part.Sku, part => part.Name);

    private async Task<Stocktake> RequireAsync(string code) => await documents.FindStocktakeAsync(code) ?? throw new DomainException(ErrorCode.NOT_FOUND);

    private async Task<AuthenticatedActor> WarehouseAsync()
    {
        var actor = actors.Current;
        await staff.RequireActiveWithRoleAsync(actor.EmployeeId, Role.WAREHOUSE_KEEPER);
        return actor;
    }

    private Task AuditAsync(AuthenticatedActor actor, string action, string label, string entityId, string? before, string? after) =>
        audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "STOCKTAKE", entityId, before, after);
}

public sealed record MovementView(
    DateTimeOffset At, string Kind, string DocumentCode, string BinCode, int Quantity, int BalanceAfter, string? Reference, string? Note, string? ActorId);

/// <summary>
/// <c>OpeningBalance</c>: tồn trước chứng từ cũ nhất đang hiện (gồm tồn khai báo lúc tạo linh kiện / dữ liệu ban đầu).
/// <c>Truncated</c>: chỉ hiện <c>Limit</c> biến động gần nhất.
/// </summary>
public sealed record StockLedgerView(
    string Sku, string Name, string? Unit, int OnHand, int Reserved, int OpeningBalance, bool Truncated, IReadOnlyList<MovementView> Movements);

/// <summary>Thẻ kho từng linh kiện: tồn sau mỗi biến động tính lùi từ tồn hiện tại.</summary>
public sealed class StockLedgerService(InventoryStore inventory, CurrentActor actors)
{
    public const int Limit = 500;

    public async Task<StockLedgerView> LedgerAsync(string sku)
    {
        actors.Require(Permission.INVENTORY_READ);
        var part = await inventory.FindPartAsync(sku) ?? throw new DomainException(ErrorCode.NOT_FOUND);
        var movements = await inventory.MovementsAsync(part.Sku, Limit + 1);
        var truncated = movements.Count > Limit;
        var balance = part.OnHand;
        var views = new List<MovementView>();
        foreach (var movement in movements.Take(Limit))
        {
            views.Add(new MovementView(movement.At, movement.Kind, movement.DocumentCode, movement.BinCode, movement.Quantity, balance,
                movement.Reference, movement.Note, movement.ActorId));
            balance -= movement.Quantity;
        }
        return new StockLedgerView(part.Sku, part.Name, part.Unit, part.OnHand, part.Reserved, balance, truncated, views);
    }
}
