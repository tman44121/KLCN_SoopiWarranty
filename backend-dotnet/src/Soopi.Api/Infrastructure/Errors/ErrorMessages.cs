using System.Globalization;
using System.Text.RegularExpressions;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Errors;

/// <summary>
/// Thông điệp lỗi tiếng Việt từ Resources/messages_vi.properties (chép nguyên văn từ bản Java). Định dạng theo
/// java.text.MessageFormat: <c>{i}</c> không có đối số tương ứng được giữ nguyên, số có dấu phân cách nghìn kiểu Việt Nam.
/// </summary>
public static partial class ErrorMessages
{
    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");
    private static readonly Dictionary<string, string> Messages = Load();

    public static string Format(ErrorCode code, IReadOnlyList<object?> arguments)
    {
        var template = Messages.GetValueOrDefault(code.MessageKey(), code.ToString());
        return Placeholder().Replace(template, match =>
        {
            var index = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            return index < arguments.Count ? Text(arguments[index]) : match.Value;
        });
    }

    private static string Text(object? value) => value switch
    {
        null => "null",
        int or long or short or byte => Convert.ToInt64(value, CultureInfo.InvariantCulture).ToString("#,##0", Vietnamese),
        decimal or double or float => Convert.ToDecimal(value, CultureInfo.InvariantCulture).ToString("#,##0.###", Vietnamese),
        _ => value.ToString() ?? "",
    };

    private static Dictionary<string, string> Load()
    {
        using var stream = typeof(ErrorMessages).Assembly.GetManifestResourceStream("Soopi.Api.Resources.messages_vi.properties")
            ?? throw new InvalidOperationException("Thiếu tài nguyên messages_vi.properties");
        using var reader = new StreamReader(stream);
        var result = new Dictionary<string, string>();
        while (reader.ReadLine() is { } line)
        {
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var separator = line.IndexOf('=');
            if (separator > 0) result[line[..separator].Trim()] = line[(separator + 1)..].Trim();
        }
        return result;
    }

    [GeneratedRegex(@"\{(\d+)\}")]
    private static partial Regex Placeholder();
}
