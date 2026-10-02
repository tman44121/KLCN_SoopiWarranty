using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Errors;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Services.Files;

namespace Soopi.Api.Infrastructure.Validation;

/// <summary>Lỗi ràng buộc của dữ liệu đọc thủ công (multipart) → 400 VALIDATION_FAILED kèm fieldErrors.</summary>
public sealed class RequestValidationException(IReadOnlyList<FieldErrorView> fieldErrors) : Exception("VALIDATION_FAILED")
{
    public IReadOnlyList<FieldErrorView> FieldErrors { get; } = fieldErrors;
}

/// <summary>
/// Như @Valid @RequestPart("data") của Spring: part "data" là JSON (Blob application/json từ web, hoặc trường văn bản từ app),
/// tệp ở các part còn lại. Ràng buộc đặt trên thuộc tính (<c>[property: NotBlank]</c>) vì DTO này không qua model binding.
/// </summary>
public static class MultipartJson
{
    private static readonly JsonSerializerOptions Json = JsonSetup.Create();

    public static async Task<T> ReadAsync<T>(HttpRequest request, string part = "data")
    {
        if (!request.HasFormContentType) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var form = await request.ReadFormAsync();
        string? text = form[part];
        if (text is null && form.Files.GetFile(part) is { } file)
        {
            using var reader = new StreamReader(file.OpenReadStream());
            text = await reader.ReadToEndAsync();
        }
        if (string.IsNullOrWhiteSpace(text)) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var value = JsonSerializer.Deserialize<T>(text, Json) ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var errors = Validate(value, "");
        return errors.Count == 0 ? value : throw new RequestValidationException(errors);
    }

    public static async Task<List<Upload>> FilesAsync(HttpRequest request, string part)
    {
        var uploads = new List<Upload>();
        foreach (var file in (await request.ReadFormAsync()).Files.GetFiles(part))
        {
            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer);
            uploads.Add(new Upload(file.FileName, buffer.ToArray()));
        }
        return uploads;
    }

    /// <summary>Kiểm ràng buộc trên thuộc tính, đi sâu vào thuộc tính là record lồng (như @Valid lồng của Bean Validation).</summary>
    private static List<FieldErrorView> Validate(object value, string prefix)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(value, new ValidationContext(value), results, validateAllProperties: true);
        var errors = results
            .SelectMany(result => result.MemberNames.Select(member => new FieldErrorView(prefix + JsonNamingPolicy.CamelCase.ConvertName(member), result.ErrorMessage ?? "")))
            .ToList();
        foreach (var property in value.GetType().GetProperties())
        {
            if (property.PropertyType.Namespace?.StartsWith("Soopi.", StringComparison.Ordinal) == true && property.GetValue(value) is { } nested)
                errors.AddRange(Validate(nested, prefix + JsonNamingPolicy.CamelCase.ConvertName(property.Name) + "."));
        }
        return errors;
    }
}
