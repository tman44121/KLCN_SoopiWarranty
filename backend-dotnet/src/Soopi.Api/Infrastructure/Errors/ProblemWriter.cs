using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Json;

namespace Soopi.Api.Infrastructure.Errors;

public sealed record FieldErrorView(string Field, string Message);

/// <summary>Lỗi RFC 9457 giống ApiErrorHandler của bản Java: type/title/status/detail/instance + code, correlationId, fieldErrors.</summary>
public static class ProblemWriter
{
    private const string ErrorBase = "https://longmanloc.vn/errors/";
    private static readonly JsonSerializerOptions Json = JsonSetup.Create();

    public static ProblemDetails Create(
        HttpContext context,
        ErrorCode code,
        IReadOnlyList<object?>? arguments = null,
        int? status = null,
        IReadOnlyList<FieldErrorView>? fieldErrors = null)
    {
        var httpStatus = status ?? code.Status();
        var problem = new ProblemDetails
        {
            Type = ErrorBase + code,
            Title = httpStatus is >= 400 and < 500 ? "Yêu cầu không hợp lệ" : "Lỗi hệ thống",
            Status = httpStatus,
            Detail = ErrorMessages.Format(code, arguments ?? []),
            Instance = context.Request.PathBase + context.Request.Path,
        };
        problem.Extensions["code"] = code.ToString();
        problem.Extensions["correlationId"] = CorrelationIdMiddleware.Current(context);
        problem.Extensions["fieldErrors"] = fieldErrors ?? [];
        return problem;
    }

    public static async Task WriteAsync(
        HttpContext context,
        ErrorCode code,
        IReadOnlyList<object?>? arguments = null,
        int? status = null,
        IReadOnlyList<FieldErrorView>? fieldErrors = null)
    {
        var problem = Create(context, code, arguments, status, fieldErrors);
        context.Response.StatusCode = problem.Status!.Value;
        await context.Response.WriteAsJsonAsync(problem, typeof(ProblemDetails), Json, "application/problem+json");
    }
}
