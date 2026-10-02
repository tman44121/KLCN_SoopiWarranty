namespace Soopi.Api.Infrastructure.Security;

/// <summary>
/// BCrypt cost 12, lưu dạng "{bcrypt}$2a$12$…" như DelegatingPasswordEncoder của Spring (CHECK CK_TaiKhoan_Hash đòi tiền tố
/// "{…}"), nên hash cũ của bản Java vẫn kiểm được.
/// </summary>
public static class PasswordHasher
{
    private const string Prefix = "{bcrypt}";

    /// <summary>Hash thật để so khi tên đăng nhập không tồn tại — thời gian phản hồi như khi sai mật khẩu.</summary>
    public static readonly string DummyHash = Encode(Guid.NewGuid().ToString());

    public static string Encode(string raw) => Prefix + BCrypt.Net.BCrypt.HashPassword(raw, 12);

    public static bool Matches(string? raw, string? encoded)
    {
        if (encoded is null || !encoded.StartsWith(Prefix, StringComparison.Ordinal)) return false;
        try
        {
            return BCrypt.Net.BCrypt.Verify(raw ?? "", encoded[Prefix.Length..]);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }
}
