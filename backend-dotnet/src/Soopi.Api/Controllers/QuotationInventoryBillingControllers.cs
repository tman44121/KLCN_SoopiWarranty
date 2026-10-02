using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Validation;
using Soopi.Api.Services.Billing;
using Soopi.Api.Services.Inventory;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.Quotations;
using Soopi.Api.Services.Tickets;

namespace Soopi.Api.Controllers;

public sealed record ReviewRequest(string? Note);

public sealed record RejectRequest([NotBlank] string Note);

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class QuotationsController(QuotationService quotations, QuotationReviewService reviews, CustomerDecisionService decisions) : ControllerBase
{
    [HttpPost("tickets/{ticketCode}/quotations")]
    public async Task<IActionResult> Create(string ticketCode, [FromBody] QuotationRequest body) =>
        StatusCode(StatusCodes.Status201Created, await quotations.CreateAsync(ticketCode, body));

    [HttpGet("quotations")]
    public Task<PageResponse<QuotationView>> Search([FromQuery] string approvalStatus = "PENDING", [FromQuery] int page = 0, [FromQuery] int size = 25) =>
        quotations.SearchAsync(approvalStatus, page, size);

    [HttpGet("quotations/{code}")]
    public Task<QuotationView> Get(string code) => quotations.GetAsync(code);

    [HttpPut("quotations/{code}/lines")]
    public Task<QuotationView> UpdateLines(string code, [FromBody] LinesRequest body) => quotations.UpdateLinesAsync(code, body.Lines);

    [HttpPost("quotations/{code}/approve")]
    public Task<QuotationView> Approve(string code, [FromBody] ReviewRequest? body = null) => reviews.ApproveAsync(code, body?.Note);

    [HttpPost("quotations/{code}/reject")]
    public Task<QuotationView> Reject(string code, [FromBody] RejectRequest body) => reviews.RejectAsync(code, body.Note);

    [HttpPost("quotations/{code}/customer-decision")]
    public Task<QuotationView> Decide(string code, [FromBody] DecisionRequest body) => decisions.DecideAsync(code, body.Decision, body.Reason);
}

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class InventoryController(PartQueryService parts, StockIssueService issues, StockReceiptService receipts, StockTransferService transfers) : ControllerBase
{
    [HttpGet("parts")]
    public Task<List<PartView>> Parts([FromQuery] string? q, [FromQuery] string? category, [FromQuery] bool lowStock = false) =>
        parts.ListAsync(q, category, lowStock);

    [HttpGet("parts/low-stock")]
    public Task<List<PartView>> LowStock() => parts.ListAsync(null, null, true);

    [HttpGet("parts/{sku}")]
    public Task<PartView> Part(string sku) => parts.GetAsync(sku);

    [HttpPost("stock-issues")]
    public async Task<IActionResult> RequestIssue([FromBody] IssueRequest body) => StatusCode(StatusCodes.Status201Created, await issues.RequestAsync(body));

    [HttpGet("stock-issues")]
    public Task<List<IssueView>> Issues([FromQuery] string? status) => issues.ListAsync(status);

    [HttpGet("stock-issues/mine")]
    public Task<List<IssueView>> MyIssues([FromQuery] string? status) => issues.MineAsync(status);

    [HttpPost("stock-issues/{code}/approve")]
    public Task<ApprovalView> ApproveIssue(string code, [FromBody] ApproveIssueRequest? body = null) =>
        issues.ApproveAsync(code, (body?.LineBins ?? []).GroupBy(line => line.Sku).ToDictionary(group => group.Key, group => group.Last().BinCode));

    [HttpPost("stock-issues/{code}/reject")]
    public Task<IssueView> RejectIssue(string code, [FromBody] ReasonRequest body) => issues.RejectAsync(code, body.Reason);

    [HttpGet("stock-receipts")]
    public Task<List<StockReceiptView>> Receipts([FromQuery] string? status) => receipts.ListAsync(status);

    [HttpPost("stock-receipts")]
    public async Task<IActionResult> CreateReceipt([FromBody] ReceiptRequest body) => StatusCode(StatusCodes.Status201Created, await receipts.CreateAsync(body));

    [HttpGet("stock-receipts/{code}")]
    public Task<StockReceiptView> Receipt(string code) => receipts.GetAsync(code);

    [HttpPut("stock-receipts/{code}/lines")]
    public Task<StockReceiptView> UpdateReceipt(string code, [FromBody] ReceiptLinesRequest body) => receipts.UpdateLinesAsync(code, body.Lines);

    [HttpPost("stock-receipts/{code}/approve")]
    public Task<StockReceiptView> ApproveReceipt(string code) => receipts.ApproveAsync(code);

    [HttpPost("stock-receipts/{code}/reject")]
    public Task<StockReceiptView> RejectReceipt(string code, [FromBody] ReasonRequest body) => receipts.RejectAsync(code, body.Reason);

    [HttpGet("stock-transfers")]
    public Task<List<TransferView>> Transfers([FromQuery] string? status) => transfers.ListAsync(status);

    [HttpPost("stock-transfers")]
    public async Task<IActionResult> CreateTransfer([FromBody] TransferRequest body) => StatusCode(StatusCodes.Status201Created, await transfers.CreateAsync(body));

    [HttpPost("stock-transfers/{code}/approve")]
    public Task<TransferView> ApproveTransfer(string code) => transfers.ApproveAsync(code);

    [HttpPost("stock-transfers/{code}/reject")]
    public Task<TransferView> RejectTransfer(string code, [FromBody] ReasonRequest body) => transfers.RejectAsync(code, body.Reason);
}

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class BillingHandoverController(PaymentService payments, BillingQueryService billing, HandoverService handovers) : ControllerBase
{
    [HttpGet("tickets/{code}/billing")]
    public Task<BillingView> Billing(string code) => billing.BillingAsync(code);

    [HttpPost("tickets/{code}/payments")]
    public async Task<IActionResult> Collect(string code, [FromBody] CollectPaymentRequest body) =>
        StatusCode(StatusCodes.Status201Created, await payments.CollectAsync(code, body));

    [HttpPost("tickets/{code}/payments/free-warranty")]
    public async Task<IActionResult> ConfirmFreeWarranty(string code, [FromBody] FreeWarrantyRequest? body = null) =>
        StatusCode(StatusCodes.Status201Created, await payments.ConfirmFreeWarrantyAsync(code, body?.Note));

    [HttpGet("customers/{customerCode}/payments")]
    public Task<List<PaymentView>> CustomerPayments(string customerCode) => billing.ByCustomerAsync(customerCode);

    [HttpPost("tickets/{code}/handover")]
    public async Task<TicketView> HandOver(string code)
    {
        var data = await MultipartJson.ReadAsync<HandoverRequest>(Request);
        var signature = (await MultipartJson.FilesAsync(Request, "signature")).FirstOrDefault();
        return await handovers.HandOverAsync(code, data.Input(), signature?.Content);
    }

    [HttpGet("tickets/{code}/handover-slip")]
    public Task<SlipView> HandoverSlip(string code) => handovers.SlipAsync(code);
}
