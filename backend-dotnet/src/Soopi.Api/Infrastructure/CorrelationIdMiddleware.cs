namespace Soopi.Api.Infrastructure;

/// <summary>Header X-Correlation-Id: dùng giá trị client gửi hoặc sinh mới, trả lại trong response và log scope.</summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public const string Header = "X-Correlation-Id";
    private const string ItemKey = "correlationId";

    public async Task InvokeAsync(HttpContext context)
    {
        var supplied = context.Request.Headers[Header].ToString();
        var correlationId = string.IsNullOrWhiteSpace(supplied) ? Guid.NewGuid().ToString() : supplied;
        context.Items[ItemKey] = correlationId;
        context.Response.Headers[Header] = correlationId;
        using (logger.BeginScope(new Dictionary<string, object> { [ItemKey] = correlationId }))
        {
            await next(context);
        }
    }

    public static string Current(HttpContext context) => context.Items[ItemKey] as string ?? "";
}
