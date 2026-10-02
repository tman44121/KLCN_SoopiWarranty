using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Notifications;

public sealed record NotificationView(string Id, string Type, string Message, string? Link, string? EntityId, DateTimeOffset? CreatedAt, bool Read);

public sealed record Inbox(IReadOnlyList<NotificationView> Items, long UnreadCount);

/// <summary>Chuông thông báo (mục 11.10): người dùng thấy thông báo gửi tới tài khoản mình hoặc tới một vai trò mình có.</summary>
public sealed class NotificationQueryService(Sql sql, CurrentActor actors, TimeProvider clock)
{
    private const int MaxItems = 50;
    private const string Unread = " AND NOT EXISTS (SELECT 1 FROM ThongBao_DaDoc d WHERE d.MaThongBao = t.MaThongBao AND d.MaTaiKhoan = @p0)";

    /// <summary>Danh sách và số chưa đọc trong một lượt tới DB.</summary>
    public async Task<Inbox> InboxAsync(bool unreadOnly)
    {
        var (visible, args) = Visible(actors.RequireSignedIn());
        var items = new List<NotificationView>();
        long unread = 0;
        await sql.ReadBatchAsync(
            "SELECT t.MaThongBao, t.Loai, t.NoiDung, t.DuongDan, t.MaDoiTuong, t.NgayTao, CASE WHEN EXISTS (SELECT 1 FROM ThongBao_DaDoc d "
            + $"WHERE d.MaThongBao = t.MaThongBao AND d.MaTaiKhoan = @p0) THEN 1 ELSE 0 END AS DaDoc FROM ThongBao t WHERE {visible}"
            + (unreadOnly ? Unread : "") + $" ORDER BY t.NgayTao DESC, t.MaThongBao DESC OFFSET 0 ROWS FETCH NEXT {MaxItems} ROWS ONLY;"
            + $"SELECT COUNT(*) FROM ThongBao t WHERE {visible}{Unread};",
            args,
            row => items.Add(new NotificationView(row.Long("MaThongBao").ToString(), row.Str("Loai")!, row.Str("NoiDung")!, row.Str("DuongDan"),
                row.Str("MaDoiTuong"), row.Time("NgayTao"), row.Bool("DaDoc"))),
            row => unread = row.GetInt32(0));
        return new Inbox(items, unread);
    }

    public async Task MarkReadAsync(string id)
    {
        var actor = actors.RequireSignedIn();
        if (!long.TryParse(id, out var notificationId)) throw new DomainException(ErrorCode.NOT_FOUND);
        var (visible, args) = Visible(actor);
        var count = 0;
        await sql.ReadBatchAsync($"SELECT COUNT(*) FROM ThongBao t WHERE t.MaThongBao = @p{args.Count} AND {visible};", [.. args, notificationId],
            row => count = row.GetInt32(0));
        if (count == 0) throw new DomainException(ErrorCode.NOT_FOUND);
        await sql.ExecuteAsync(
            "MERGE ThongBao_DaDoc WITH (HOLDLOCK) AS d USING (VALUES (?, ?, ?)) AS n (MaThongBao, MaTaiKhoan, DocLuc) ON d.MaThongBao = n.MaThongBao "
            + "AND d.MaTaiKhoan = n.MaTaiKhoan WHEN NOT MATCHED THEN INSERT (MaThongBao, MaTaiKhoan, DocLuc) VALUES (n.MaThongBao, n.MaTaiKhoan, n.DocLuc);",
            notificationId, actor.AccountId, clock.GetUtcNow());
    }

    public async Task MarkAllReadAsync()
    {
        var (visible, args) = Visible(actors.RequireSignedIn());
        await sql.ReadBatchAsync(
            $"MERGE ThongBao_DaDoc WITH (HOLDLOCK) AS d USING (SELECT t.MaThongBao FROM ThongBao t WHERE {visible}{Unread}) AS n "
            + "ON d.MaThongBao = n.MaThongBao AND d.MaTaiKhoan = @p0 WHEN NOT MATCHED THEN INSERT (MaThongBao, MaTaiKhoan, DocLuc) "
            + $"VALUES (n.MaThongBao, @p0, @p{args.Count});",
            [.. args, clock.GetUtcNow()]);
    }

    /// <summary>
    /// Điều kiện "thông báo gửi tới tài khoản này hoặc một vai trò của nó". Tham số theo vị trí: @p0 = tài khoản, @p1… = vai trò, (mã thông báo hoặc thời điểm ở cuối,
    /// nếu nơi gọi thêm) — khớp vị trí trong danh sách trả về.
    /// </summary>
    private static (string Sql, List<object?> Args) Visible(AuthenticatedActor actor)
    {
        var roles = actor.RoleNames;
        var args = new List<object?> { actor.AccountId };
        args.AddRange(roles);
        var sql = roles.Count == 0
            ? "(t.MaTaiKhoanNhan = @p0)"
            : $"(t.MaTaiKhoanNhan = @p0 OR t.MaVaiTroNhan IN ({string.Join(", ", roles.Select((_, index) => "@p" + (index + 1)))}))";
        return (sql, args);
    }
}
