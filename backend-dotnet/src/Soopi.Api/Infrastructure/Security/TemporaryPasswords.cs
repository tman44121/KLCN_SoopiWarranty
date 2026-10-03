using System.Security.Cryptography;

namespace Soopi.Api.Infrastructure.Security;

/// <summary>Mật khẩu tạm ngẫu nhiên 12 ký tự (đủ PasswordPolicy), bỏ ký tự dễ đọc nhầm (I/l/1, O/0) vì thường được đọc miệng.</summary>
public static class TemporaryPasswords
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";

    public static string New()
    {
        var chars = new char[12];
        for (var index = 0; index < chars.Length; index++)
        {
            var source = index % 3 == 2 ? Digits : Alphabet;
            chars[index] = source[RandomNumberGenerator.GetInt32(source.Length)];
        }
        return new string(chars);
    }
}
