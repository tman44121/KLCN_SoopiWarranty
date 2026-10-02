using Soopi.Api.Domain.Shared;

namespace Soopi.Api.DTOs.Shared;

public sealed record PageResponse<T>(IReadOnlyList<T> Items, int Page, int Size, long TotalItems, int TotalPages)
{
    public static PageResponse<T> Of(IReadOnlyList<T> items, int page, int size, long totalItems) =>
        new(items, page, size, totalItems, size == 0 ? 1 : (int)Math.Ceiling(totalItems / (double)size));
}

/// <summary>Phân trang có kiểm tra: page ≥ 0, size ∈ {25, 50, 100}; sort dạng "field,asc|desc" trong danh sách cho phép.</summary>
public sealed record PageRequestParams(int Page, int Size, string? Sort)
{
    private static readonly HashSet<int> AllowedSizes = [25, 50, 100];

    public PageRequestParams Validate()
    {
        if (Page < 0 || !AllowedSizes.Contains(Size)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return this;
    }

    public (string Field, bool Descending) ParseSort(IReadOnlySet<string> allowedFields, string defaultField, bool defaultDescending)
    {
        if (string.IsNullOrWhiteSpace(Sort)) return (defaultField, defaultDescending);
        var parts = Sort.Split(',');
        if (parts.Length != 2 || !allowedFields.Contains(parts[0])) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return parts[1].ToUpperInvariant() switch
        {
            "ASC" => (parts[0], false),
            "DESC" => (parts[0], true),
            _ => throw new DomainException(ErrorCode.VALIDATION_FAILED),
        };
    }

    public int Offset => Page * Size;
}
