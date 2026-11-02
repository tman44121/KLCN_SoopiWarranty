using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Shared;

namespace Soopi.Api.Data.Stores;

public enum InventoryDocumentKind { Receipt, Issue, Transfer, Stocktake }

public sealed record InventoryDocumentFilter(string? Status, string? Query, DateTimeOffset? From, DateTimeOffset? To, string Sort, int Page, int Size)
{
    public void Validate(InventoryDocumentKind kind)
    {
        new PageRequestParams(Page, Size, null).Validate();
        var approved = kind switch { InventoryDocumentKind.Receipt => "APPROVED", InventoryDocumentKind.Issue => "ISSUED", _ => "COMPLETED" };
        if ((Status is not (null or "" or "PENDING" or "REJECTED") && Status != approved)
            || Sort is not ("newest" or "oldest") || (From is not null && To is not null && From > To))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
    }
}
