using System.Globalization;
using Soopi.Api.Data;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Chat;

public sealed record ChatContact(string TicketCode, string StaffAccountId, string? ConversationId, string Name, string Role,
    string ProductName, string Serial, bool CanSend, long UnreadCount);
public sealed record ChatDirectory(IReadOnlyList<ChatContact> Items, bool HasMore, long UnreadCount);
public sealed record ChatMessage(string Id, bool Mine, string Text, DateTimeOffset? CreatedAt);
public sealed record ChatHistory(IReadOnlyList<ChatMessage> Items, bool HasMore, bool CanSend);

/// <summary>Chat riêng theo phiếu; không dùng quyền đọc toàn bộ khách hàng để mở rộng danh bạ.</summary>
public sealed class ChatService(Sql sql, CurrentActor actors, TransactionRunner transactions, TimeProvider clock)
{
    private const int PageSize = 25;
    private const string Joins = "\n" + """
        FROM PhieuTiepNhan p
        JOIN KhachHang k ON k.MaKH=p.MaKH
        JOIN TaiKhoan ck ON ck.MaTaiKhoan=k.MaTaiKhoan AND ck.LoaiChuThe='CUSTOMER'
        JOIN ThietBi d ON d.MaThietBi=p.MaThietBi JOIN SanPham sp ON sp.MaSP=d.MaSP
        LEFT JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN
        """ + "\n";
    private const string ActivePair = "\n" + """
        k.TrangThai='ACTIVE' AND ck.TrangThai='ACTIVE' AND e.TrangThaiLamViec='ACTIVE' AND ek.TrangThai='ACTIVE'
        AND (e.MaNV=p.MaNVTiepNhan OR e.MaNV=pc.MaKTV)
        """ + "\n";

    private long Account() => actors.RequireSignedIn().AccountId ?? throw new DomainException(ErrorCode.ACCESS_DENIED);
    private static long Id(string id) => long.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var value) && value > 0
        ? value : throw new DomainException(ErrorCode.NOT_FOUND);

    public async Task<ChatDirectory> ContactsAsync(string? q, int page)
    {
        var account = Account();
        q = q?.Trim() ?? "";
        if (q.Length > 100 || page < 0 || page > 100000) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        // Include former participants only when they already have a private history on this ticket.
        var rows = await sql.QueryAsync("""
            WITH Pairs AS (
                SELECT p.MaPhieuTN, k.MaTaiKhoan AS CustomerAccount, e.MaTaiKhoan AS StaffAccount
                FROM PhieuTiepNhan p JOIN KhachHang k ON k.MaKH=p.MaKH
                LEFT JOIN PhanCong pc ON pc.MaPhieuTN=p.MaPhieuTN
                JOIN NhanVien e ON e.MaNV=p.MaNVTiepNhan OR e.MaNV=pc.MaKTV
                UNION
                SELECT MaPhieuTN, MaTaiKhoanKhach, MaTaiKhoanNV FROM HoiThoai
            )
            SELECT p.MaPhieuTN, e.MaTaiKhoan AS StaffAccount, c.MaHoiThoai,
                CASE WHEN k.MaTaiKhoan=? THEN e.HoTen ELSE k.HoTen END AS PeerName,
                CASE WHEN k.MaTaiKhoan<>? THEN N'Khách hàng'
                    WHEN e.MaNV=p.MaNVTiepNhan AND e.MaNV=pc.MaKTV THEN N'Tiếp nhận / Kỹ thuật viên'
                    WHEN e.MaNV=p.MaNVTiepNhan THEN N'Tiếp nhận' ELSE N'Kỹ thuật viên' END AS PeerRole,
                sp.TenSP, d.SoSerial_IMEI,
            """ + $"CASE WHEN {ActivePair} THEN 1 ELSE 0 END AS CanSend, " + """
                (SELECT COUNT_BIG(*) FROM TinNhan m WHERE m.MaHoiThoai=c.MaHoiThoai AND m.MaNguoiGui<>?
                    AND m.MaTinNhan>CASE WHEN k.MaTaiKhoan=? THEN c.KhachDaDocDen ELSE c.NVDaDocDen END) AS UnreadCount
            """ + Joins + """
                JOIN Pairs pairs ON pairs.MaPhieuTN=p.MaPhieuTN AND pairs.CustomerAccount=k.MaTaiKhoan
                JOIN NhanVien e ON e.MaTaiKhoan=pairs.StaffAccount
                JOIN TaiKhoan ek ON ek.MaTaiKhoan=e.MaTaiKhoan AND ek.LoaiChuThe='EMPLOYEE'
                LEFT JOIN HoiThoai c ON c.MaPhieuTN=p.MaPhieuTN AND c.MaTaiKhoanKhach=k.MaTaiKhoan AND c.MaTaiKhoanNV=e.MaTaiKhoan
                WHERE (k.MaTaiKhoan=? OR e.MaTaiKhoan=?)
            """ + $" AND (c.MaHoiThoai IS NOT NULL OR ({ActivePair})) " + """
                AND (?='' OR (CASE WHEN k.MaTaiKhoan=? THEN e.HoTen ELSE k.HoTen END) LIKE ?
                    OR p.MaPhieuTN LIKE ? OR sp.TenSP LIKE ? OR d.SoSerial_IMEI LIKE ? OR k.MaKH LIKE ?)
                ORDER BY CASE WHEN c.MaHoiThoai IS NULL THEN 1 ELSE 0 END, c.NgayCapNhat DESC, p.NgayTiepNhan DESC, p.MaPhieuTN, e.MaTaiKhoan
                OFFSET ? ROWS FETCH NEXT 26 ROWS ONLY
            """, r => new ChatContact(r.Str("MaPhieuTN")!, r.Str("StaffAccount")!, r.Str("MaHoiThoai"), r.Str("PeerName")!,
                r.Str("PeerRole")!, r.Str("TenSP")!, r.Str("SoSerial_IMEI")!, r.Bool("CanSend"), r.Long("UnreadCount")),
            account, account, account, account, account, account, q, account,
            SqlLike.Contains(q), SqlLike.Contains(q), SqlLike.Contains(q), SqlLike.Contains(q), SqlLike.Contains(q), page * PageSize);
        var unread = Convert.ToInt64(await sql.ScalarAsync("""
            SELECT COUNT_BIG(*) FROM HoiThoai c JOIN PhieuTiepNhan p ON p.MaPhieuTN=c.MaPhieuTN
            JOIN KhachHang k ON k.MaKH=p.MaKH AND k.MaTaiKhoan=c.MaTaiKhoanKhach
            JOIN TinNhan m ON m.MaHoiThoai=c.MaHoiThoai
            WHERE (c.MaTaiKhoanKhach=? OR c.MaTaiKhoanNV=?) AND m.MaNguoiGui<>?
                AND m.MaTinNhan>CASE WHEN c.MaTaiKhoanKhach=? THEN c.KhachDaDocDen ELSE c.NVDaDocDen END
            """, account, account, account, account));
        return new(rows.Take(PageSize).ToList(), rows.Count > PageSize, unread);
    }

    public Task<string> StartAsync(string ticket, string staffAccountId) => transactions.InTransactionAsync(async () =>
    {
        var account = Account();
        var staff = Id(staffAccountId);
        if (string.IsNullOrWhiteSpace(ticket) || ticket.Length > 30) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        // Lock the ticket before checking assignment, following TicketStore's write order.
        await sql.ScalarAsync("SELECT MaPhieuTN FROM PhieuTiepNhan WITH (UPDLOCK,HOLDLOCK) WHERE MaPhieuTN=?", ticket);
        var customer = await sql.ScalarAsync("SELECT k.MaTaiKhoan " + Joins + """
            JOIN NhanVien e ON e.MaTaiKhoan=? JOIN TaiKhoan ek ON ek.MaTaiKhoan=e.MaTaiKhoan AND ek.LoaiChuThe='EMPLOYEE'
            WHERE p.MaPhieuTN=? AND (k.MaTaiKhoan=? OR e.MaTaiKhoan=?) AND
            """ + ActivePair, staff, ticket, account, account);
        if (customer is null) throw new DomainException(ErrorCode.NOT_FOUND);
        var existing = await sql.ScalarAsync("SELECT MaHoiThoai FROM HoiThoai WITH (UPDLOCK,HOLDLOCK) WHERE MaPhieuTN=? AND MaTaiKhoanKhach=? AND MaTaiKhoanNV=?", ticket, customer, staff);
        if (existing is not null) return Convert.ToString(existing, CultureInfo.InvariantCulture)!;
        return Convert.ToString(await sql.ScalarAsync("INSERT HoiThoai (MaPhieuTN,MaTaiKhoanKhach,MaTaiKhoanNV,NgayCapNhat) OUTPUT INSERTED.MaHoiThoai VALUES (?,?,?,?)",
            ticket, customer, staff, clock.GetUtcNow()), CultureInfo.InvariantCulture)!;
    });

    private sealed record Conversation(long Customer, long Staff, bool CanSend);

    private async Task<Conversation> RequireAsync(long id)
    {
        var account = Account();
        // Never inherit a former technician's conversation merely by being assigned the same ticket.
        var ticket = await sql.ScalarAsync("SELECT MaPhieuTN FROM HoiThoai WHERE MaHoiThoai=? AND (MaTaiKhoanKhach=? OR MaTaiKhoanNV=?)", id, account, account);
        if (ticket is null) throw new DomainException(ErrorCode.NOT_FOUND);
        if (sql.InTransaction)
            await sql.ScalarAsync("SELECT MaPhieuTN FROM PhieuTiepNhan WITH (UPDLOCK,HOLDLOCK) WHERE MaPhieuTN=?", ticket);
        return await sql.FirstOrDefaultAsync("SELECT c.MaTaiKhoanKhach,c.MaTaiKhoanNV," + $"CASE WHEN {ActivePair} THEN 1 ELSE 0 END AS CanSend "
            + Joins + $" JOIN HoiThoai c{sql.LockHint} ON c.MaPhieuTN=p.MaPhieuTN AND c.MaTaiKhoanKhach=k.MaTaiKhoan "
            + "JOIN NhanVien e ON e.MaTaiKhoan=c.MaTaiKhoanNV JOIN TaiKhoan ek ON ek.MaTaiKhoan=e.MaTaiKhoan AND ek.LoaiChuThe='EMPLOYEE' "
            + "WHERE c.MaHoiThoai=? AND (c.MaTaiKhoanKhach=? OR c.MaTaiKhoanNV=?)",
            r => new Conversation(r.Long("MaTaiKhoanKhach"), r.Long("MaTaiKhoanNV"), r.Bool("CanSend")), id, account, account)
            ?? throw new DomainException(ErrorCode.NOT_FOUND);
    }

    public async Task<ChatHistory> MessagesAsync(string conversationId, string? before, string? after = null)
    {
        var id = Id(conversationId);
        var conversation = await RequireAsync(id);
        if (before is not null && after is not null) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var cursor = after is not null ? after == "0" ? 0 : Id(after) : before is null ? long.MaxValue : Id(before);
        var rows = await sql.QueryAsync($"SELECT TOP 51 MaTinNhan,MaNguoiGui,NoiDung,NgayTao FROM TinNhan WHERE MaHoiThoai=? AND MaTinNhan{(after is null ? "<" : ">")}? ORDER BY MaTinNhan {(after is null ? "DESC" : "ASC")}",
            r => new ChatMessage(r.Str("MaTinNhan")!, r.Long("MaNguoiGui") == Account(), r.Str("NoiDung")!, r.Time("NgayTao")), id, cursor);
        var page = rows.Take(50);
        return new((after is null ? page.Reverse() : page).ToList(), rows.Count > 50, conversation.CanSend);
    }

    public Task<ChatMessage> SendAsync(string conversationId, string? text, string? requestId) => transactions.InTransactionAsync(async () =>
    {
        var account = Account();
        var id = Id(conversationId);
        if (string.IsNullOrWhiteSpace(text) || text.Length > 2000 || !Guid.TryParse(requestId, out var request) || request == Guid.Empty)
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var conversation = await RequireAsync(id);
        text = text.Trim();
        var duplicate = await sql.FirstOrDefaultAsync("SELECT MaTinNhan,MaNguoiGui,NoiDung,NgayTao FROM TinNhan WHERE MaHoiThoai=? AND MaYeuCau=?",
            r => new ChatMessage(r.Str("MaTinNhan")!, r.Long("MaNguoiGui") == account, r.Str("NoiDung")!, r.Time("NgayTao")), id, request);
        if (duplicate is not null)
        {
            if (!duplicate.Mine || duplicate.Text != text) throw new DomainException(ErrorCode.VALIDATION_FAILED);
            return duplicate;
        }
        if (!conversation.CanSend) throw new DomainException(ErrorCode.ACCESS_DENIED);
        var now = clock.GetUtcNow();
        var messageId = Convert.ToString(await sql.ScalarAsync("INSERT TinNhan (MaHoiThoai,MaNguoiGui,MaYeuCau,NoiDung,NgayTao) OUTPUT INSERTED.MaTinNhan VALUES (?,?,?,?,?)", id, account, request, text, now), CultureInfo.InvariantCulture)!;
        await sql.ExecuteAsync("UPDATE HoiThoai SET NgayCapNhat=? WHERE MaHoiThoai=?", now, id);
        return new ChatMessage(messageId, true, text, now);
    });

    public Task ReadAsync(string conversationId, string lastMessageId) => transactions.InTransactionAsync(async () =>
    {
        var id = Id(conversationId);
        var last = Id(lastMessageId);
        var conversation = await RequireAsync(id);
        if (await sql.ScalarAsync("SELECT MaTinNhan FROM TinNhan WHERE MaHoiThoai=? AND MaTinNhan=?", id, last) is null)
            throw new DomainException(ErrorCode.NOT_FOUND);
        var column = conversation.Customer == Account() ? "KhachDaDocDen" : "NVDaDocDen";
        await sql.ExecuteAsync($"UPDATE HoiThoai SET {column}=? WHERE MaHoiThoai=? AND {column}<?", last, id, last);
    });
}
