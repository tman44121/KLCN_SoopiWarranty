namespace Soopi.Api.Infrastructure;

/// <summary>Header bảo mật như Spring Security của bản Java (mặc định + CSP, Referrer-Policy; HSTS chỉ production).</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    // Font tự host ở /fonts (Inter, Plus Jakarta Sans có subset tiếng Việt); không còn tải từ Google Fonts.
    private const string Csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        + "font-src 'self'; img-src 'self' data: blob: https://img.vietqr.io; "
        + "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.ContentSecurityPolicy = Csp;
            headers["Referrer-Policy"] = "same-origin";
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers.XXSSProtection = "0";
            if (!headers.ContainsKey("Cache-Control"))
            {
                headers.CacheControl = "no-cache, no-store, max-age=0, must-revalidate";
                headers.Pragma = "no-cache";
                headers.Expires = "0";
            }
            if (environment.IsProduction() && context.Request.IsHttps)
                headers.StrictTransportSecurity = "max-age=31536000 ; includeSubDomains";
            return Task.CompletedTask;
        });
        return next(context);
    }
}
