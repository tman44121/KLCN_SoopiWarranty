using Soopi.Api.Data;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Portal;

public sealed record PublicReview(string Id, int Rating, string? Comment, DateOnly ReviewedOn);
public sealed record PublicReviews(long ReviewCount, decimal? AverageRating, IReadOnlyList<PublicReview> Items);

public sealed class PublicReviewService(Sql sql, CurrentActor actors, TransactionRunner transactions, AuditService audit, TimeProvider clock)
{
    internal const string Verified = "bg.NgayDanhGia IS NOT NULL AND bg.DanhGiaHaiLong BETWEEN 1 AND 5 AND p.TrangThaiXuLy IN ('DELIVERED','RETURNED_UNREPAIRED')";
    // Approval is bound to the exact review; a customer edit immediately hides the previous publication.
    public const string Matches = """
        pub.SoSao=bg.DanhGiaHaiLong AND pub.NgayDanhGia=bg.NgayDanhGia
        AND ISNULL(pub.NoiDung,N'') COLLATE Latin1_General_100_BIN2=ISNULL(bg.NhanXetDanhGia,N'') COLLATE Latin1_General_100_BIN2
        AND DATALENGTH(ISNULL(pub.NoiDung,N''))=DATALENGTH(ISNULL(bg.NhanXetDanhGia,N''))
        """;

    public async Task<PublicReviews> ListAsync()
    {
        const string source = " FROM PhieuBanGiao bg JOIN PhieuTiepNhan p ON p.MaPhieuTN=bg.MaPhieuTN WHERE " + Verified;
        var summary = (await sql.QueryAsync("SELECT COUNT_BIG(*) AS N,AVG(CAST(bg.DanhGiaHaiLong AS DECIMAL(10,2))) AS Average" + source,
            r => (Count: r.Long("N"), Average: r.DecOrNull("Average")))).Single();
        var rows = await sql.QueryAsync("SELECT TOP 6 pub.MaCongKhai,bg.DanhGiaHaiLong,bg.NhanXetDanhGia,bg.NgayDanhGia "
            + "FROM DanhGiaCongKhai pub JOIN PhieuBanGiao bg ON bg.MaPhieuTN=pub.MaPhieuTN JOIN PhieuTiepNhan p ON p.MaPhieuTN=bg.MaPhieuTN "
            + "WHERE " + Verified + " AND " + Matches + " ORDER BY bg.NgayDanhGia DESC,pub.MaCongKhai",
            r => new PublicReview(r.Str("MaCongKhai")!, r.Int("DanhGiaHaiLong"), r.Str("NhanXetDanhGia"), DbTime.Date(r.Time("NgayDanhGia")!.Value)));
        return new(summary.Count, summary.Average is { } value ? decimal.Round(value, 1, MidpointRounding.AwayFromZero) : null, rows);
    }

    public async Task SetPublicationAsync(string ticketCode, bool? published, int? rating, DateTimeOffset? ratedAt, string? comment)
    {
        var actor = actors.RequireSignedIn();
        if (!actor.Roles.Contains(Role.ADMIN) || actor.AccountId is null) throw new DomainException(ErrorCode.ACCESS_DENIED);
        if (string.IsNullOrWhiteSpace(ticketCode) || ticketCode.Length > 30 || published is null || comment?.Length > 1000
            || (published.Value && (rating is null or < 1 or > 5 || ratedAt is null)))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        await transactions.InTransactionAsync(async () =>
        {
            if (await sql.ScalarAsync("SELECT MaPhieuTN FROM PhieuTiepNhan WITH (UPDLOCK,HOLDLOCK) WHERE MaPhieuTN=?", ticketCode) is null)
                throw new DomainException(ErrorCode.NOT_FOUND);
            if (!published.Value)
            {
                if (await sql.ExecuteAsync("DELETE FROM DanhGiaCongKhai WHERE MaPhieuTN=?", ticketCode) == 0) return;
            }
            else
            {
                var current = await sql.FirstOrDefaultAsync("SELECT bg.DanhGiaHaiLong,bg.NhanXetDanhGia,bg.NgayDanhGia "
                    + "FROM PhieuBanGiao bg WITH (UPDLOCK,HOLDLOCK) JOIN PhieuTiepNhan p ON p.MaPhieuTN=bg.MaPhieuTN WHERE p.MaPhieuTN=? AND " + Verified,
                    r => new { Rating = r.Int("DanhGiaHaiLong"), Comment = r.Str("NhanXetDanhGia"), RatedAt = r.Time("NgayDanhGia") }, ticketCode)
                    ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
                if (current.Rating != rating || current.RatedAt != ratedAt || !string.Equals(current.Comment ?? "", comment ?? "", StringComparison.Ordinal))
                    throw new DomainException(ErrorCode.CONCURRENT_MODIFICATION);
                if (await sql.ScalarAsync("SELECT 1 FROM DanhGiaCongKhai pub JOIN PhieuBanGiao bg ON bg.MaPhieuTN=pub.MaPhieuTN WHERE bg.MaPhieuTN=? AND " + Matches, ticketCode) is not null) return;
                await sql.ExecuteAsync("""
                    MERGE DanhGiaCongKhai WITH (HOLDLOCK) AS d USING (VALUES (?,?,?,?,?,?,?)) AS s (MaPhieuTN,MaCongKhai,SoSao,NoiDung,NgayDanhGia,MaNguoiDuyet,NgayDuyet)
                    ON d.MaPhieuTN=s.MaPhieuTN
                    WHEN MATCHED THEN UPDATE SET SoSao=s.SoSao,NoiDung=s.NoiDung,NgayDanhGia=s.NgayDanhGia,MaNguoiDuyet=s.MaNguoiDuyet,NgayDuyet=s.NgayDuyet
                    WHEN NOT MATCHED THEN INSERT (MaPhieuTN,MaCongKhai,SoSao,NoiDung,NgayDanhGia,MaNguoiDuyet,NgayDuyet)
                    VALUES (s.MaPhieuTN,s.MaCongKhai,s.SoSao,s.NoiDung,s.NgayDanhGia,s.MaNguoiDuyet,s.NgayDuyet);
                    """, ticketCode, Guid.NewGuid(), current.Rating, current.Comment, current.RatedAt, actor.AccountId, clock.GetUtcNow());
            }
            await audit.RecordAsync(actor.AuditId, actor.DisplayName, actor.RoleNames, published.Value ? "REVIEW_PUBLISHED" : "REVIEW_HIDDEN",
                published.Value ? "Hiển thị đánh giá trên trang chủ" : "Ẩn đánh giá khỏi trang chủ", "TICKET", ticketCode);
        });
    }
}
