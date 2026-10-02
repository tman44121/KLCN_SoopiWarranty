using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Security;

/// <summary>
/// Giới hạn tần suất theo cửa sổ cố định trong bộ nhớ (đăng nhập, tra cứu portal, OTP). Khóa là tên đăng nhập / mã phiếu /
/// SĐT nên không dùng middleware RateLimiter của ASP.NET (chỉ theo request).
/// </summary>
public sealed class RateLimiter(IMemoryCache cache, TimeProvider clock)
{
    // ponytail: một khóa chung cho mọi lượt đếm — đủ cho lưu lượng đăng nhập/tra cứu; tách theo khóa nếu thành nút cổ chai.
    private readonly Lock gate = new();

    public void Acquire(string key, int limit, TimeSpan window)
    {
        var now = clock.GetUtcNow();
        bool denied;
        lock (gate)
        {
            var current = cache.Get<Window>(key);
            var next = current is null || now >= current.StartedAt + window
                ? new Window(now, 1)
                : current with { Count = current.Count + 1 };
            cache.Set(key, next, next.StartedAt + window + window);
            denied = next.Count > limit;
        }
        if (denied) throw new DomainException(ErrorCode.RATE_LIMITED);
    }

    /// <summary>Đăng nhập / đổi mật khẩu: tối đa 10 lần/IP/phút và 5 lần/tài khoản/phút.</summary>
    public void CheckLogin(string? ip, string username)
    {
        Acquire("login-ip:" + ip, 10, TimeSpan.FromMinutes(1));
        Acquire("login-user:" + username, 5, TimeSpan.FromMinutes(1));
    }

    private sealed record Window(DateTimeOffset StartedAt, int Count);
}
