using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text;
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
    private const int MaxJsonBytes = 64 * 1024;

    public static async Task<T> ReadAsync<T>(HttpRequest request, string part = "data")
    {
        if (!request.HasFormContentType) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var form = await request.ReadFormAsync();
        string? text = form[part];
        if (text is null && form.Files.GetFile(part) is { } file)
        {
            using var reader = new StreamReader(new MemoryStream(await ReadBytesAsync(file, MaxJsonBytes, request.HttpContext.RequestAborted)));
            text = await reader.ReadToEndAsync();
        }
        if (string.IsNullOrWhiteSpace(text) || Encoding.UTF8.GetByteCount(text) > MaxJsonBytes) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var value = JsonSerializer.Deserialize<T>(text, Json) ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var errors = Validate(value, "");
        return errors.Count == 0 ? value : throw new RequestValidationException(errors);
    }

    public static async Task<List<Upload>> FilesAsync(HttpRequest request, string part, int maxFiles = AttachmentService.MaxFiles, int maxBytes = AttachmentService.MaxVideoBytes)
    {
        var files = (await request.ReadFormAsync()).Files.GetFiles(part);
        if (files.Count > maxFiles || files.Any(file => file.Length < 12 || file.Length > maxBytes))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var cancellation = request.HttpContext.RequestAborted;
        foreach (var file in files)
        {
            using var stream = file.OpenReadStream();
            var header = new byte[12];
            if (await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken: cancellation) != header.Length)
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
            var type = AttachmentService.Sniff(header) ?? throw new DomainException(ErrorCode.VALIDATION_FAILED);
            if (file.Length > (type.StartsWith("video/", StringComparison.Ordinal) ? AttachmentService.MaxVideoBytes : AttachmentService.MaxImageBytes))
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
        }
        var uploads = new List<Upload>();
        foreach (var file in files)
            uploads.Add(new Upload(file.FileName, await ReadBytesAsync(file, maxBytes, cancellation)));
        return uploads;
    }

    private static async Task<byte[]> ReadBytesAsync(IFormFile file, int maxBytes, CancellationToken cancellation)
    {
        if (file.Length < 0 || file.Length > maxBytes) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        var content = new byte[(int)file.Length];
        using var stream = file.OpenReadStream();
        try
        {
            await stream.ReadExactlyAsync(content, cancellation);
            if (await stream.ReadAsync(new byte[1], cancellation) != 0) throw new DomainException(ErrorCode.VALIDATION_FAILED);
        }
        catch (EndOfStreamException) { throw new DomainException(ErrorCode.VALIDATION_FAILED); }
        return content;
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
