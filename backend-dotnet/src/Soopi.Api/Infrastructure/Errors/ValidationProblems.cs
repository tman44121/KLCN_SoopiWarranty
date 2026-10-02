using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Errors;

public static class ValidationProblems
{
    /// <summary>
    /// Lỗi ràng buộc dữ liệu vào → 400 VALIDATION_FAILED kèm fieldErrors (như MethodArgumentNotValidException). Body JSON
    /// hỏng/thiếu hoặc sai kiểu → 400 với fieldErrors rỗng (như HttpMessageNotReadableException).
    /// </summary>
    public static IActionResult Create(ActionContext context)
    {
        var bodyParameters = context.ActionDescriptor.Parameters
            .Where(parameter => parameter.BindingInfo?.BindingSource == BindingSource.Body)
            .Select(parameter => parameter.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var entries = context.ModelState.Where(entry => entry.Value is { Errors.Count: > 0 }).ToList();
        var unreadable = entries.Any(entry => entry.Key.Length == 0 || entry.Key.StartsWith('$') || bodyParameters.Contains(entry.Key)
            || entry.Value!.Errors.Any(error => error.Exception is not null));
        var fieldErrors = unreadable
            ? []
            : entries.SelectMany(entry => entry.Value!.Errors.Select(error => new FieldErrorView(FieldPath(entry.Key), error.ErrorMessage))).ToList();
        var problem = ProblemWriter.Create(context.HttpContext, ErrorCode.VALIDATION_FAILED, fieldErrors: fieldErrors);
        return new ObjectResult(problem) { StatusCode = 400, ContentTypes = { "application/problem+json" } };
    }

    /// <summary>"Customer.NewCustomer.Phone" → "customer.newCustomer.phone", "Lines[0].Sku" → "lines[0].sku" như Spring.</summary>
    private static string FieldPath(string key) =>
        string.Join('.', key.Split('.').Select(segment => segment.Length == 0 ? segment : char.ToLowerInvariant(segment[0]) + segment[1..]));
}
