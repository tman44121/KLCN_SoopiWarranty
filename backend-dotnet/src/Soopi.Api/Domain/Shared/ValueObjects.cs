using System.Text.RegularExpressions;
using System.Diagnostics.CodeAnalysis;

namespace Soopi.Api.Domain.Shared;

/// <summary>String.isBlank / String.trim của Java, khác .NET với NBSP và ký tự điều khiển.</summary>
public static class JavaText
{
    private static readonly char[] TrimCharacters = Enumerable.Range(0, 33).Select(value => (char)value).ToArray();
    public static bool IsBlank([NotNullWhen(false)] string? value) => value is null || value.All(character =>
        character is >= '\u001c' and <= '\u001f' || char.IsWhiteSpace(character) && character is not ('\u0085' or '\u00a0' or '\u2007' or '\u202f'));
    public static string Trim(string value) => value.Trim(TrimCharacters);
}

public static partial class PhoneNumber
{
    /// <summary>Bỏ ký tự không phải số/dấu +, đổi +84 thành 0.</summary>
    public static string Normalize(string? raw)
    {
        if (raw is null) return "";
        var digits = NotDigitOrPlus().Replace(raw, "");
        if (digits.StartsWith("+84", StringComparison.Ordinal)) digits = "0" + digits[3..];
        return digits.Replace("+", "");
    }

    /// <summary>Số đã chuẩn hóa dạng 0 + 9–10 chữ số; sai → VALIDATION_FAILED kèm lý do.</summary>
    public static string Require(string? raw)
    {
        var value = Normalize(raw);
        if (value.Length == 0) throw DomainException.Invalid("Vui lòng nhập số điện thoại.");
        if (!Valid().IsMatch(value))
            throw DomainException.Invalid("Số điện thoại \"" + JavaText.Trim(raw ?? "") + "\" không hợp lệ — cần 10 hoặc 11 chữ số và bắt đầu bằng 0 (ví dụ 0912345678).");
        return value;
    }

    [GeneratedRegex("[^0-9+]")]
    private static partial Regex NotDigitOrPlus();

    [GeneratedRegex("^0[0-9]{9,10}$")]
    private static partial Regex Valid();
}

public static partial class EmailAddress
{
    /// <summary>Bỏ khoảng trắng hai đầu, chữ thường.</summary>
    public static string Normalize(string? raw) => raw is null ? "" : JavaText.Trim(raw).ToLowerInvariant();

    /// <summary>Email đã chuẩn hóa, tối đa 100 ký tự (cột Email); sai → VALIDATION_FAILED kèm lý do.</summary>
    public static string Require(string? raw)
    {
        var value = Normalize(raw);
        if (value.Length == 0) throw DomainException.Invalid("Vui lòng nhập email.");
        if (value.Length > 100) throw DomainException.Invalid("Email quá dài — tối đa 100 ký tự.");
        if (!Valid().IsMatch(value)) throw DomainException.Invalid("Email \"" + value + "\" không đúng định dạng (ví dụ ten@gmail.com).");
        return value;
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex Valid();
}

public static partial class SerialNumber
{
    /// <summary>
    /// Bỏ khoảng trắng, viết hoa. IMEI hay được chép kèm gạch (35-481210-987654-0) nên chuỗi chỉ gồm 15 số và gạch thì bỏ gạch,
    /// để tra cứu, đăng ký và cổng khách hàng đều khớp với bản đã lưu.
    /// </summary>
    public static string Normalize(string? raw)
    {
        if (raw is null) return "";
        var value = Whitespace().Replace(raw, "").ToUpperInvariant();
        // ponytail: serial thật dạng "15 số chia gạch" sẽ bị gộp như IMEI — chưa gặp; tách theo loại định danh nếu xảy ra.
        var undashed = value.Replace("-", "");
        return undashed.Length != value.Length && Imei.IsDigits15(undashed) ? undashed : value;
    }

    public static string Require(string? raw)
    {
        var value = Normalize(raw);
        if (!Valid().IsMatch(value)) throw new DomainException(ErrorCode.SERIAL_REQUIRED);
        return value;
    }

    [GeneratedRegex("[ \t\n\x0B\f\r]")]
    private static partial Regex Whitespace();

    [GeneratedRegex("^[A-Z0-9-]{4,50}$")]
    private static partial Regex Valid();
}

public static partial class Imei
{
    /// <summary>IMEI dùng cùng giới hạn 4–50 ký tự chữ, số, dấu gạch ngang như Serial.</summary>
    public static string Require(string? raw)
    {
        try { return SerialNumber.Require(raw); }
        catch (DomainException)
        {
            throw new DomainException(ErrorCode.IMEI_INVALID, "cần 4–50 ký tự chữ, số hoặc dấu gạch ngang");
        }
    }

    internal static bool IsDigits15(string value) => Digits15().IsMatch(value);

    [GeneratedRegex("^[0-9]{15}$")]
    private static partial Regex Digits15();
}

public static class Money
{
    /// <summary>Làm tròn tới đồng như BigDecimal.setScale(0, HALF_UP) — .NET mặc định làm tròn kiểu ngân hàng.</summary>
    public static decimal Round(decimal value) => Math.Round(value, 0, MidpointRounding.AwayFromZero);
}
