using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;

namespace Soopi.Tests;

public class InventoryDocumentFilterTests
{
    [Fact]
    public void StatusMustBelongToTheDocumentType()
    {
        var filter = new InventoryDocumentFilter("ISSUED", null, null, null, "newest", 0, 25);
        filter.Validate(InventoryDocumentKind.Issue);
        Assert.Throws<DomainException>(() => filter.Validate(InventoryDocumentKind.Receipt));
        Assert.Throws<DomainException>(() => (filter with { Sort = "newest; DROP TABLE LinhKien" }).Validate(InventoryDocumentKind.Issue));
    }

    [Fact]
    public void RangeAndPageMustBeValid()
    {
        var filter = new InventoryDocumentFilter(null, "Màn hình", DateTimeOffset.Parse("2026-11-03T00:00:00+07:00"), DateTimeOffset.Parse("2026-11-02T23:59:59+07:00"), "oldest", 0, 25);
        Assert.Throws<DomainException>(() => filter.Validate(InventoryDocumentKind.Transfer));
        Assert.Throws<DomainException>(() => (filter with { From = null, Page = -1 }).Validate(InventoryDocumentKind.Transfer));
        (filter with { From = null, Status = "COMPLETED" }).Validate(InventoryDocumentKind.Transfer);
    }
}
