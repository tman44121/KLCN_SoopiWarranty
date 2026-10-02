using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Catalog;

/// <summary>Danh mục quản trị (mục 11.8). Danh mục tham chiếu (trừ linh kiện) giữ trong bộ nhớ <c>Catalog:CacheTtl</c>.</summary>
public sealed class CatalogService(
    CatalogStore store,
    CodeGenerator codes,
    CurrentActor actors,
    AuditService audit,
    TransactionRunner transactions,
    IMemoryCache cache,
    IConfiguration configuration)
{
    private static readonly Dictionary<string, string> Collections = new()
    {
        ["device-categories"] = "device_categories",
        ["brands"] = "brands",
        ["products"] = "products",
        ["warranty-policies"] = "warranty_policies",
        ["service-prices"] = "service_prices",
        ["suppliers"] = "suppliers",
        ["stations"] = "service_stations",
        ["parts"] = "parts",
    };

    private static readonly HashSet<string> StockFields = ["onHand", "reserved", "bins"];
    private static readonly HashSet<string> MoneyFields = ["price", "costPrice", "servicePrice"];

    private TimeSpan CacheTtl => configuration.GetValue("Catalog:CacheTtl", TimeSpan.FromMinutes(5));

    public async Task<List<Dictionary<string, object?>>> ListAsync(string type)
    {
        actors.Require(Permission.CATALOG_READ);
        var collection = CollectionOf(type);
        var values = type == "parts" || CacheTtl <= TimeSpan.Zero
            ? await store.ListAsync(collection)
            : await cache.GetOrCreateAsync(CacheKey(collection), entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheTtl;
                return store.ListAsync(collection);
            }) ?? [];
        return values.Select(value => Presentable(type, value)).ToList();
    }

    public async Task<Dictionary<string, object?>> GetAsync(string type, string code)
    {
        actors.Require(Permission.CATALOG_READ);
        return Presentable(type, await store.FindAsync(CollectionOf(type), code) ?? throw new DomainException(ErrorCode.NOT_FOUND));
    }

    public Task<Dictionary<string, object?>> CreateAsync(string type, Dictionary<string, JsonElement> body)
    {
        actors.Require(Permission.CATALOG_MANAGE);
        return ChangedAsync(() => transactions.InTransactionAsync(async () =>
        {
            var collection = CollectionOf(type);
            var id = Text(body.GetValueOrDefault("code")) ?? await GeneratedCodeAsync(type) ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
            if (await store.FindAsync(collection, id) is not null) throw new DomainException(ErrorCode.CONCURRENT_MODIFICATION);
            var value = Sanitize(type, body, null);
            value.TryAdd("active", true);
            var saved = await store.SaveAsync(collection, id, value);
            await AuditAsync("CATALOG_CREATED", "Thêm danh mục", type, id, null, Summary(saved));
            return saved;
        }));
    }

    public Task<Dictionary<string, object?>> UpdateAsync(string type, string code, Dictionary<string, JsonElement> body)
    {
        actors.Require(Permission.CATALOG_MANAGE);
        return ChangedAsync(() => transactions.InTransactionAsync(async () =>
        {
            var collection = CollectionOf(type);
            var existing = await store.FindAsync(collection, code) ?? throw new DomainException(ErrorCode.NOT_FOUND);
            var value = Sanitize(type, body, existing);
            if (existing.GetValueOrDefault("active") is true && value.GetValueOrDefault("active") is false
                && await store.IsReferencedByOpenTicketAsync(type, code))
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
            var saved = await store.SaveAsync(collection, code, value);
            await AuditAsync("CATALOG_UPDATED", "Cập nhật danh mục", type, code, Summary(existing), Summary(saved));
            return saved;
        }));
    }

    /// <summary>Linh kiện không gồm tồn kho (xem ở /parts); giá vốn chỉ trả khi có INVENTORY_READ_COST (POL-05).</summary>
    private Dictionary<string, object?> Presentable(string type, Dictionary<string, object?> value)
    {
        if (type != "parts") return value;
        var showCost = actors.Current.Permissions.Contains(Permission.INVENTORY_READ_COST);
        return value.Where(pair => !StockFields.Contains(pair.Key) && (showCost || pair.Key != "costPrice"))
            .ToDictionary(pair => pair.Key, pair => pair.Value);
    }

    /// <summary>Danh mục liên quan nhau (loại thiết bị ↔ sản phẩm, hãng ↔ nhóm) nên mọi thay đổi xóa toàn bộ cache.</summary>
    private async Task<T> ChangedAsync<T>(Func<Task<T>> write)
    {
        try
        {
            return await write();
        }
        finally
        {
            foreach (var collection in Collections.Values) cache.Remove(CacheKey(collection));
        }
    }

    private static Dictionary<string, object?> Sanitize(string type, Dictionary<string, JsonElement> body, Dictionary<string, object?>? existing)
    {
        var value = existing is null ? new Dictionary<string, object?>() : new Dictionary<string, object?>(existing);
        foreach (var (key, item) in body)
        {
            if (key is "code" or "_id") continue;
            var plain = CatalogStore.Plain(item);
            value[key] = MoneyFields.Contains(key) ? Money(plain) : plain;
        }
        if (type == "parts")
        {
            foreach (var field in StockFields)
            {
                if (existing is null) value.Remove(field);
                else value[field] = existing.GetValueOrDefault(field);
            }
            value.TryAdd("onHand", 0);
            value.TryAdd("reserved", 0);
            value.TryAdd("bins", new List<object?>());
        }
        return value;
    }

    private static decimal Money(object? value)
    {
        decimal? amount = value switch
        {
            decimal number => number,
            string text when decimal.TryParse(text.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null,
        };
        return amount is { } money && money >= 0 ? Domain.Shared.Money.Round(money) : throw new DomainException(ErrorCode.VALIDATION_FAILED);
    }

    private async Task<string?> GeneratedCodeAsync(string type) => type switch
    {
        "products" => await codes.NextAsync(BusinessCodeType.Product),
        "warranty-policies" => await codes.NextAsync(BusinessCodeType.WarrantyPolicy),
        "suppliers" => await codes.NextAsync(BusinessCodeType.Supplier),
        _ => null,
    };

    private Task AuditAsync(string action, string label, string type, string id, string? before, string? after)
    {
        var actor = actors.Current;
        return audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, action, label, "CATALOG:" + type, id, before, after);
    }

    private static string Summary(Dictionary<string, object?> value) => $"{value.GetValueOrDefault("_id")} — {value.GetValueOrDefault("name") ?? ""}";

    private static string? Text(JsonElement value) =>
        value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()) ? value.GetString()!.Trim() : null;

    private static string CollectionOf(string type) => Collections.GetValueOrDefault(type) ?? throw new DomainException(ErrorCode.NOT_FOUND);

    private static string CacheKey(string collection) => "catalog:" + collection;
}
