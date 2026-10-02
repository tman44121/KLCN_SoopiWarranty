namespace Soopi.Api.Data.Entities;

/// <summary>Bảng RefreshToken: chỉ lưu SHA-256 (hex) của token; xoay vòng theo họ token (HoToken).</summary>
public class RefreshToken
{
    private const int MaxIp = 45;
    private const int MaxUserAgent = 255;

    private RefreshToken()
    {
    }

    public RefreshToken(
        string tokenHash, long accountId, string familyId, DateTimeOffset issuedAt, DateTimeOffset expiresAt,
        bool remember, string? ip, string? userAgent)
    {
        TokenHash = tokenHash;
        AccountId = accountId;
        FamilyId = familyId;
        IssuedAt = issuedAt;
        ExpiresAt = expiresAt;
        Remember = remember;
        Ip = Truncate(ip, MaxIp);
        UserAgent = Truncate(userAgent, MaxUserAgent);
    }

    public long Id { get; private set; }

    public string TokenHash { get; private set; } = "";

    public long AccountId { get; private set; }

    public string FamilyId { get; private set; } = "";

    public DateTimeOffset IssuedAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }

    public string? ReplacedByHash { get; private set; }

    public bool Remember { get; private set; }

    public string? Ip { get; private set; }

    public string? UserAgent { get; private set; }

    public bool Active(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;

    public void Rotate(DateTimeOffset now, string replacementHash)
    {
        RevokedAt = now;
        ReplacedByHash = replacementHash;
    }

    public void Revoke(DateTimeOffset now) => RevokedAt ??= now;

    private static string? Truncate(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
