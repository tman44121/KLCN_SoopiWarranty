using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Json;

/// <summary>JSON như Jackson của bản Java: camelCase, enum theo tên, thời điểm ISO-8601 UTC "…Z", boolean null = false.</summary>
public static class JsonSetup
{
    public static void Apply(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PropertyNameCaseInsensitive = false;
        // Tiếng Việt ghi nguyên UTF-8 như Jackson (không thoát thành ê).
        options.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
        options.Converters.Add(new JavaEnumConverterFactory());
        options.Converters.Add(new JavaNullableConverterFactory());
        options.Converters.Add(new UtcInstantConverter());
        options.Converters.Add(new NullAsFalseConverter());
        options.Converters.Add(new JavaStringConverter());
        options.Converters.Add(new JavaIntegerConverter());
        options.Converters.Add(new JavaDecimalConverter());
        options.Converters.Add(new JavaDateConverter());
    }

    public static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        Apply(options);
        return options;
    }
}

/// <summary>Tương đương java.time.Instant: ghi "2026-09-26T03:15:00Z" (phần lẻ giây chỉ khi có), đọc mọi offset ISO-8601.</summary>
public sealed class UtcInstantConverter : JsonConverter<DateTimeOffset>
{
    private static readonly Regex Timestamp = new(@"\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?(?:Z|[+-][0-9]{2}:[0-9]{2})\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number)
        {
            if (!reader.TryGetDecimal(out var seconds)) throw new JsonException("Invalid Instant");
            return FromEpoch(seconds);
        }
        if (reader.TokenType != JsonTokenType.String) throw new JsonException("Invalid Instant");
        var text = JavaText.Trim(reader.GetString()!);
        if (decimal.TryParse(text, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var timestamp))
            return FromEpoch(timestamp);
        if (!Timestamp.IsMatch(text) || !DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var value))
            throw new JsonException("Invalid Instant");
        // ponytail: DateTimeOffset has 100ns precision; preserve nanoseconds only if the model changes.
        return value.ToUniversalTime();
    }

    private static DateTimeOffset FromEpoch(decimal seconds)
    {
        try { return DateTimeOffset.UnixEpoch.AddTicks(checked((long)(seconds * TimeSpan.TicksPerSecond))); }
        catch (Exception error) when (error is OverflowException or ArgumentOutOfRangeException) { throw new JsonException("Invalid Instant", error); }
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options)
    {
        var utc = value.UtcDateTime;
        var ticks = utc.Ticks % TimeSpan.TicksPerSecond;
        var digits = ticks == 0 ? 0 : ticks % 10000 == 0 ? 3 : ticks % 10 == 0 ? 6 : 9;
        var fraction = digits == 0 ? "" : "." + (ticks * 100).ToString("D9", CultureInfo.InvariantCulture)[..digits];
        writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture) + fraction + "Z");
    }
}

public sealed class JavaNullableConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => Nullable.GetUnderlyingType(typeToConvert) is { } type
        && (type == typeof(bool) || type == typeof(int) || type == typeof(decimal) || type == typeof(DateOnly) || type == typeof(DateTimeOffset));
    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(JavaNullableConverter<>).MakeGenericType(Nullable.GetUnderlyingType(typeToConvert)!))!;

    private sealed class JavaNullableConverter<T> : JsonConverter<T?> where T : struct
    {
        public override bool HandleNull => true;
        public override T? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null) return null;
            if (reader.TokenType == JsonTokenType.String)
            {
                var text = JavaText.Trim(reader.GetString()!);
                if (text.Length == 0 || text == "null" && (typeof(T) == typeof(bool) || typeof(T) == typeof(int) || typeof(T) == typeof(decimal))) return null;
            }
            return JsonSerializer.Deserialize<T>(ref reader, options);
        }
        public override void Write(Utf8JsonWriter writer, T? value, JsonSerializerOptions options)
        {
            if (value is null) writer.WriteNullValue();
            else JsonSerializer.Serialize(writer, value.Value, options);
        }
    }
}

public sealed class JavaDecimalConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetDecimal(out var value)) return value;
        if (reader.TokenType == JsonTokenType.String && decimal.TryParse(JavaText.Trim(reader.GetString()!), NumberStyles.Float, CultureInfo.InvariantCulture, out value)) return value;
        throw new JsonException("Invalid BigDecimal");
    }
    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options) => writer.WriteNumberValue(value);
}

public sealed class JavaDateConverter : JsonConverter<DateOnly>
{
    public override DateOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.StartArray)
        {
            var parts = new int[3];
            for (var index = 0; index < 3; index++)
                if (!reader.Read() || reader.TokenType != JsonTokenType.Number || !reader.TryGetInt32(out parts[index])) throw new JsonException("Invalid LocalDate");
            if (!reader.Read() || reader.TokenType != JsonTokenType.EndArray) throw new JsonException("Invalid LocalDate");
            try { return new DateOnly(parts[0], parts[1], parts[2]); }
            catch (ArgumentOutOfRangeException error) { throw new JsonException("Invalid LocalDate", error); }
        }
        if (reader.TokenType != JsonTokenType.String) throw new JsonException("Invalid LocalDate");
        var text = JavaText.Trim(reader.GetString()!);
        if (DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)) return day;
        var formats = new[] { "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF", "yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'" };
        if (DateTime.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) return DateOnly.FromDateTime(date);
        throw new JsonException("Invalid LocalDate");
    }
    public override void Write(Utf8JsonWriter writer, DateOnly value, JsonSerializerOptions options) => writer.WriteStringValue(value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
}

/// <summary>Jackson của bản Java tắt fail-on-null-for-primitives: trường boolean gửi null được hiểu là false.</summary>
public sealed class NullAsFalseConverter : JsonConverter<bool>
{
    public override bool HandleNull => true;

    public override bool Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number) return reader.TryGetInt64(out var number) ? number != 0 : throw new JsonException("Invalid boolean");
        if (reader.TokenType == JsonTokenType.String) return JavaText.Trim(reader.GetString()!) switch
        {
            "true" or "True" or "TRUE" => true,
            "false" or "False" or "FALSE" or "" or "null" => false,
            _ => throw new JsonException("Invalid boolean"),
        };
        return reader.TokenType switch
        {
            JsonTokenType.Null => false,
            JsonTokenType.True => true,
            JsonTokenType.False => false,
            _ => throw new JsonException("Giá trị boolean không hợp lệ"),
        };
    }

    public override void Write(Utf8JsonWriter writer, bool value, JsonSerializerOptions options) => writer.WriteBooleanValue(value);
}

public sealed class JavaStringConverter : JsonConverter<string>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String) return reader.GetString();
        if (reader.TokenType == JsonTokenType.True) return "true";
        if (reader.TokenType == JsonTokenType.False) return "false";
        if (reader.TokenType != JsonTokenType.Number) throw new JsonException("Invalid String");
        using var number = JsonDocument.ParseValue(ref reader);
        return number.RootElement.GetRawText();
    }
    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options) => writer.WriteStringValue(value);
}

public sealed class JavaIntegerConverter : JsonConverter<int>
{
    public override bool HandleNull => true;
    public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return 0;
        if (reader.TokenType == JsonTokenType.String)
        {
            var text = JavaText.Trim(reader.GetString()!);
            if (text is "" or "null") return 0;
            if (int.TryParse(text, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var integer)) return integer;
        }
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetDecimal(out var number)
            && number >= int.MinValue && number <= int.MaxValue) return (int)number;
        throw new JsonException("Invalid int");
    }
    public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options) => writer.WriteNumberValue(value);
}

public sealed class JavaEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;
    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(JavaEnumConverter<>).MakeGenericType(typeToConvert))!;

    private sealed class JavaEnumConverter<T> : JsonConverter<T> where T : struct, Enum
    {
        private static readonly T[] Values = Enum.GetValues<T>();
        private static readonly string[] Names = Enum.GetNames<T>();
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            int ordinal;
            if (reader.TokenType == JsonTokenType.String)
            {
                var text = JavaText.Trim(reader.GetString()!);
                var index = Array.IndexOf(Names, text);
                if (index >= 0) return Values[index];
                if (!int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out ordinal) || ordinal.ToString(CultureInfo.InvariantCulture) != text) throw new JsonException("Invalid enum");
            }
            else if (reader.TokenType != JsonTokenType.Number || !reader.TryGetInt32(out ordinal)) throw new JsonException("Invalid enum");
            if (ordinal < 0 || ordinal >= Values.Length) throw new JsonException("Invalid enum");
            return Values[ordinal];
        }
        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) => writer.WriteStringValue(value.ToString());
    }
}
