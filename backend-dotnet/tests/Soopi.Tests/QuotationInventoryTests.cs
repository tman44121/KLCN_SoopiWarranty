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
    public void Quotation_ExpiresAfterLocalValidityDay_OrExactlyThreeDaysAfterApproval()
    {
        var quotation = NewQuotation(validUntil: Today);
        quotation.Approve("NV-001", null, Now);
        var midnight = new DateTimeOffset(2026, 9, 27, 0, 0, 0, TimeSpan.FromHours(7));
        Assert.False(quotation.Expire(midnight.AddTicks(-1)));
        Assert.True(quotation.Expire(midnight));
        Assert.False(quotation.Expire(midnight.AddMinutes(1)));
        Assert.Equal("DECLINED", quotation.CustomerDecision.Status);
        Assert.Equal("SYSTEM", quotation.CustomerDecision.RecordedBy);
        Assert.Null(quotation.CustomerDecision.Channel);

        var withoutDate = NewQuotation();
        Assert.False(withoutDate.Expire(Now.AddDays(10)));
        withoutDate.Approve("NV-001", null, Now.AddHours(2));
        var deadline = Now.AddHours(2).AddDays(3);
        Assert.False(withoutDate.Expire(deadline.AddTicks(-1)));
        Assert.Equal(ErrorCode.QUOTE_EXPIRED,
            Assert.Throws<DomainException>(() => withoutDate.Accept("KH:1", "PORTAL", Today.AddDays(3), deadline)).Code);
        Assert.True(withoutDate.Expire(deadline));
    }

    [Fact]
    public void Quotation_ExpirationDoesNotOverrideCustomerDecision()
    {
        var quotation = NewQuotation();
        quotation.Approve("NV-001", null, Now);
        quotation.Accept("KH:1", "PORTAL", Today, Now);
        Assert.False(quotation.Expire(Now.AddDays(10)));
        Assert.Equal("ACCEPTED", quotation.CustomerDecision.Status);
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

    [Fact]
    public void Stocktake_RequiresReasonForDiscrepancyAndRejectsDuplicates()
    {
        var even = new StocktakeLine("LK001", "KHO-A-01-01", 5, 5, null);
        var stocktake = new Stocktake("KK-1", " ", null, [even, new StocktakeLine("LK002", "KHO-A-01-02", 3, 1, "Vỡ 2 cái")], "NV-003");
        Assert.Equal("Toàn kho", stocktake.Scope);
        Assert.Equal(-2, stocktake.Lines[1].Difference);

        string Reason(Func<Stocktake> create)
        {
            var error = Assert.Throws<DomainException>(() => create());
            return (string)error.Arguments[0]!;
        }
        Assert.Contains("lý do chênh lệch của LK002", Reason(() => new Stocktake("KK-2", null, null, [new StocktakeLine("LK002", "KHO-A-01-02", 3, 1, " ")], "NV-003")));
        Assert.Contains("nhập trùng", Reason(() => new Stocktake("KK-3", null, null, [even, even], "NV-003")));
        Assert.Contains("KHO-A-01-01", Reason(() => new Stocktake("KK-4", null, null, [even with { BinCode = "A1" }], "NV-003")));
        Assert.Contains("ít nhất 1 dòng", Reason(() => new Stocktake("KK-5", null, null, [], "NV-003")));

        stocktake.Approve("NV-106", Now);
        Assert.Equal("COMPLETED", stocktake.Status);
        Assert.Equal(ErrorCode.STOCK_DOC_NOT_PENDING, Assert.Throws<DomainException>(() => stocktake.Reject("NV-106", "x", Now)).Code);
    }
}
