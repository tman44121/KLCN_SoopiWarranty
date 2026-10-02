using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Data;

namespace Soopi.Api.Infrastructure.Security;

/// <summary>Trạng thái bảo mật của tài khoản; mọi thay đổi (khóa, quyền, mật khẩu) tăng phiên bản và xóa cache.</summary>
public sealed record SecuritySnapshot(long Version, string Status, bool Exists, bool MustChangePassword)
{
    public static readonly SecuritySnapshot Missing = new(-1, "MISSING", false, true);
}

/// <summary>Cache 30 giây phiên bản bảo mật, đọc ở mỗi request có access token (thu hồi token gần như tức thời).</summary>
public sealed class SecurityVersionCache(IMemoryCache cache, IServiceScopeFactory scopes)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

    public async Task<SecuritySnapshot> GetAsync(string accountId)
    {
        if (cache.TryGetValue(Key(accountId), out SecuritySnapshot? cached) && cached is not null) return cached;
        var snapshot = await LoadAsync(accountId);
        cache.Set(Key(accountId), snapshot, Ttl);
        return snapshot;
    }

    public void Evict(long accountId) => cache.Remove(Key(accountId.ToString()));

    private async Task<SecuritySnapshot> LoadAsync(string id)
    {
        if (!long.TryParse(id, out var accountId)) return SecuritySnapshot.Missing;
        await using var scope = scopes.CreateAsyncScope();
        var sql = scope.ServiceProvider.GetRequiredService<Sql>();
        return await sql.FirstOrDefaultAsync(
            "SELECT PhienBanBaoMat, TrangThai, BatBuocDoiMatKhau FROM TaiKhoan WHERE MaTaiKhoan = ?",
            row => new SecuritySnapshot(row.Long("PhienBanBaoMat"), row.Str("TrangThai")!, true, row.Bool("BatBuocDoiMatKhau")),
            accountId) ?? SecuritySnapshot.Missing;
    }

    private static string Key(string accountId) => "security-version:" + accountId;
}
