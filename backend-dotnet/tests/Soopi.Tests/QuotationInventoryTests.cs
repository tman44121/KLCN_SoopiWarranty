using Soopi.Api.Domain.Inventory;
using Soopi.Api.Domain.Quotations;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Services.Portal;
using Soopi.Api.Domain.Tickets;

namespace Soopi.Tests;

public class QuotationInventoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 9, 26);

    private static Quotation NewQuotation(decimal? vat = null, DateOnly? validUntil = null) =>
        new("BG-1", "TN-1", "PKT-1", "NV-002", Now, Today, validUntil, vat, null,
        [
            QuotationLine.Of(1, "LK001", "Màn hình", 1, 1_500_000.4m, 150_000m),
            QuotationLine.Of(2, null, "Vệ sinh", 2, 50_000m, 0m),
        ]);

    [Fact]
    public void Quotation_TotalsAndVatRoundHalfUp()
    {
        var quotation = NewQuotation();
        Assert.Equal(1_600_000m, quotation.PartsTotal);
        Assert.Equal(150_000m, quotation.LaborTotal);
        Assert.Equal(1_890_000m, quotation.GrandTotal);
        Assert.Equal(1_650_000m, quotation.Lines[0].LineTotal);
        // 15 × 1,1 = 16,5 → HALF_UP 17 (làm tròn kiểu ngân hàng sẽ ra 16).
        var half = new Quotation("BG-2", "TN-1", null, "NV-002", Now, Today, null, 10m, null, [QuotationLine.Of(1, null, "x", 1, 15m, 0m)]);
        Assert.Equal(17m, half.GrandTotal);
    }

    [Fact]
    public void Quotation_ReviewAndDecisionRules()
    {
        var quotation = NewQuotation(validUntil: Today);
        Assert.Equal(ErrorCode.QUOTE_SELF_REVIEW, Assert.Throws<DomainException>(() => quotation.Approve("NV-002", null, Now)).Code);
        Assert.Equal(ErrorCode.QUOTE_NOT_APPROVED, Assert.Throws<DomainException>(() => quotation.Accept("KH:1", "PORTAL", Today, Now)).Code);
        quotation.Approve("NV-001", " ok ", Now);
        Assert.Equal(ErrorCode.QUOTE_LOCKED, Assert.Throws<DomainException>(() => quotation.UpdateLines([QuotationLine.Of(1, null, "x", 1, 1, 0)])).Code);
        Assert.Equal(ErrorCode.QUOTE_EXPIRED, Assert.Throws<DomainException>(() => quotation.Accept("KH:1", "PORTAL", Today.AddDays(1), Now)).Code);
        Assert.Equal(ErrorCode.QUOTE_DECLINE_REASON_REQUIRED, Assert.Throws<DomainException>(() => quotation.Decline("KH:1", "PORTAL", " ", Now)).Code);
        quotation.Accept("KH:1", "PORTAL", Today, Now);
        Assert.Equal(ErrorCode.QUOTE_ALREADY_DECIDED, Assert.Throws<DomainException>(() => quotation.Accept("KH:1", "PORTAL", Today, Now)).Code);
        Assert.Equal(ErrorCode.QUOTE_VALID_UNTIL_BEFORE_CREATED, Assert.Throws<DomainException>(() => NewQuotation(validUntil: Today.AddDays(-1))).Code);
    }

    [Fact]
    public void StockDocuments_FollowJavaRules()
    {
        var issue = new StockIssue("PX-1", "TN-1", "FREE_WARRANTY", null, "Xuất bảo hành miễn phí", "NV-002", "NV-002", Now,
            [new IssueLine("LK001", 2, 100_000m, null, null)]);
        Assert.Equal(200_000m, issue.TotalCost);
        issue.Issue("NV-003", Now, new Dictionary<string, string> { ["LK001"] = "KHO-A-01-01" });
        issue.ApplyPartWarranty(new DateOnly(2026, 1, 31), new Dictionary<string, int> { ["LK001"] = 1 });
        Assert.Equal(new DateOnly(2026, 2, 28), issue.Lines[0].PartWarrantyExpiresOn);
        Assert.Equal(ErrorCode.STOCK_ISSUE_NOT_PENDING, Assert.Throws<DomainException>(() => issue.Reject("NV-003", "x", Now)).Code);
        Assert.Equal(ErrorCode.STOCK_RECEIPT_QTY_INVALID,
            Assert.Throws<DomainException>(() => new StockReceipt("PN-1", "NCC-001", null, Today, "NV-003", null, [ReceiptLine.Of("LK001", 0, 1, null, null)])).Code);
        Assert.Equal(ErrorCode.VALIDATION_FAILED, Assert.Throws<DomainException>(() => new StockTransfer("DC-1", "LK001", 1, "A", "A", "x", "NV-003")).Code);
    }

    [Fact]
    public void PortalSteps_MatchJava()
    {
        Assert.Equal(1, PortalTicketView.CurrentStep(TicketStatus.AWAITING_CUSTOMER_CONFIRMATION));
        Assert.Equal(5, PortalTicketView.CurrentStep(TicketStatus.COMPLETED));
        Assert.Equal(6, PortalTicketView.CurrentStep(TicketStatus.DELIVERED));
        Assert.True(PortalTicketView.IsStopped(TicketStatus.RETURNED_UNREPAIRED));
    }
}
