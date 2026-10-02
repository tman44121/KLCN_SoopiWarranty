using System.Collections;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.RegularExpressions;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Validation;

// Ràng buộc mang tên và thông điệp như Jakarta Bean Validation của bản Java (Hibernate Validator không có bản tiếng Việt
// nên trả thông điệp mặc định tiếng Anh). null hợp lệ với mọi ràng buộc trừ NotNull/NotBlank/NotEmpty, như Java.

public sealed class NotBlankAttribute : RequiredAttribute
{
    public NotBlankAttribute() => ErrorMessage = "must not be blank";
    public override bool IsValid(object? value) => value is string text && !JavaText.IsBlank(text);
}

public sealed class NotNullAttribute : RequiredAttribute
{
    public NotNullAttribute()
    {
        AllowEmptyStrings = true;
        ErrorMessage = "must not be null";
    }
}

public sealed class NotEmptyAttribute() : ValidationAttribute("must not be empty")
{
    public override bool IsValid(object? value) => value switch
    {
        null => false,
        string text => text.Length > 0,
        ICollection collection => collection.Count > 0,
        IEnumerable items => items.GetEnumerator().MoveNext(),
        _ => true,
    };
}

public sealed class PositiveAttribute() : ValidationAttribute("must be greater than 0")
{
    public override bool IsValid(object? value) => value is null || Convert.ToDecimal(value, CultureInfo.InvariantCulture) > 0;
}

public sealed class PositiveOrZeroAttribute() : ValidationAttribute("must be greater than or equal to 0")
{
    public override bool IsValid(object? value) => value is null || Convert.ToDecimal(value, CultureInfo.InvariantCulture) >= 0;
}

public sealed class MinAttribute(long min) : ValidationAttribute($"must be greater than or equal to {min}")
{
    public override bool IsValid(object? value) => value is null || Convert.ToDecimal(value, CultureInfo.InvariantCulture) >= min;
}

public sealed class MaxAttribute(long max) : ValidationAttribute($"must be less than or equal to {max}")
{
    public override bool IsValid(object? value) => value is null || Convert.ToDecimal(value, CultureInfo.InvariantCulture) <= max;
}

public sealed class DecimalMinAttribute(string min) : ValidationAttribute($"must be greater than or equal to {min}")
{
    public override bool IsValid(object? value) =>
        value is null || Convert.ToDecimal(value, CultureInfo.InvariantCulture) >= decimal.Parse(min, CultureInfo.InvariantCulture);
}

public sealed class DecimalMaxAttribute(string max) : ValidationAttribute($"must be less than or equal to {max}")
{
    public override bool IsValid(object? value) =>
        value is null || Convert.ToDecimal(value, CultureInfo.InvariantCulture) <= decimal.Parse(max, CultureInfo.InvariantCulture);
}

public sealed class SizeAttribute(int min, int max) : ValidationAttribute($"size must be between {min} and {max}")
{
    public override bool IsValid(object? value)
    {
        var size = value switch
        {
            null => (int?)null,
            string text => text.Length,
            ICollection collection => collection.Count,
            _ => null,
        };
        return size is null || (size >= min && size <= max);
    }
}

public sealed class EmailAttribute() : ValidationAttribute("must be a well-formed email address")
{
    // Patterns adapted from Hibernate Validator 9.1.3 (Apache-2.0, Red Hat Inc. and Hibernate Authors).
    // https://github.com/hibernate/hibernate-validator/tree/9.1.3.Final/engine/src/main/java/org/hibernate/validator/internal
    private const string Atom = @"[a-z0-9!#$%&'*+/=?^_`{|}~\u0080-\uFFFF-]";
    private const string QuotedAtom = """(?:[a-z0-9!#$%&'*.(),<>\[\]:;  @+/=?^_`{|}~\u0080-\uFFFF-]|\\\\|\\\")""";
    private const string LocalSegment = Atom + "+|\"" + QuotedAtom + "+\"";
    private const string DomainCharacters = @"[a-z\u0080-\uFFFF0-9!#$%&'*+/=?^_`{|}~]";
    private const string Label = DomainCharacters + "+(?:-+" + DomainCharacters + "+)*";
    private const string Ipv4 = @"[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}";
    private const string Ipv6 = @"(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(:0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))";
    private static readonly Regex Local = new(@"\A(?:" + LocalSegment + @")(?:\.(?:" + LocalSegment + @"))*\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private static readonly Regex Domain = new(@"\A(?:" + Label + @"(?:\." + Label + @")*|\[" + Ipv4 + @"\]|\[IPv6:" + Ipv6 + @"\])\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    public override bool IsValid(object? value)
    {
        if (value is null or "") return true;
        if (value is not string text) return false;
        var split = text.LastIndexOf('@');
        if (split < 0 || split > 64 || !Local.IsMatch(text[..split])) return false;
        var domain = text[(split + 1)..];
        if (!Domain.IsMatch(domain)) return false;
        try
        {
            // ASCII literals are accepted by Java IDN (including brackets); Unicode labels need punycode.
            var labels = domain.Split('.').Select(label => label.All(character => character < 128) ? label : new IdnMapping().GetAscii(label)).ToArray();
            return labels.All(label => label.Length <= 63) && string.Join('.', labels).Length <= 255;
        }
        catch (ArgumentException) { return false; }
    }
}

public sealed class PatternAttribute(string regexp) : ValidationAttribute($"must match \"{regexp}\"")
{
    private readonly Regex pattern = new("\\A(?:" + regexp + ")\\z", RegexOptions.ECMAScript | RegexOptions.CultureInvariant);

    public override bool IsValid(object? value) => value is null || (value is string text && pattern.IsMatch(text));
}
