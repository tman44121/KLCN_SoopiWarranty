using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Errors;

namespace Soopi.Api.Infrastructure.Security;

/// <summary>
/// Xác thực Bearer JWT RS256 như resource server của bản Java: token "access" phải khớp phiên bản bảo mật (`ver`) và trạng
/// thái ACTIVE của tài khoản (cache 30 s) — sai thì 401 AUTH_TOKEN_REVOKED; token "portal" chỉ cần phạm vi hợp lệ.
/// </summary>
public static class AuthSetup
{
    private const string RevokedKey = "soopi.auth-revoked";

    public static void AddSoopiAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<JwtKeys, IOptions<SecurityOptions>>((options, keys, security) =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = security.Value.Jwt.Issuer,
                    ValidateAudience = false,
                    IssuerSigningKey = keys.Verifying,
                    ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
                    ClockSkew = TimeSpan.FromSeconds(60),
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        // Java chỉ chạy resource-server filter trong security chain /api/**.
                        if (!context.Request.Path.StartsWithSegments("/api", StringComparison.Ordinal)) context.NoResult();
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = Validated,
                    OnChallenge = async context =>
                    {
                        context.HandleResponse();
                        var revoked = context.HttpContext.Items.ContainsKey(RevokedKey);
                        await ProblemWriter.WriteAsync(
                            context.HttpContext, revoked ? ErrorCode.AUTH_TOKEN_REVOKED : ErrorCode.AUTH_TOKEN_INVALID);
                    },
                    OnForbidden = context => ProblemWriter.WriteAsync(context.HttpContext, ErrorCode.ACCESS_DENIED),
                };
            });
        services.AddAuthorization();
    }

    private static async Task Validated(TokenValidatedContext context)
    {
        var principal = context.Principal!;
        var http = context.HttpContext;
        var type = principal.FindFirstValue("typ");
        if (type == "portal")
        {
            if (PortalGrant.FromClaim(principal.FindFirstValue("scope")) is { } grant) http.Items[CurrentActor.PortalKey] = grant;
            else Revoke(context);
            return;
        }
        var subject = principal.FindFirstValue("sub");
        var expected = type == "access" && subject is not null
            ? await http.RequestServices.GetRequiredService<SecurityVersionCache>().GetAsync(subject)
            : SecuritySnapshot.Missing;
        if (!expected.Exists || expected.Status != "ACTIVE" || principal.FindFirstValue("ver") != expected.Version.ToString())
        {
            Revoke(context);
            return;
        }
        var roleNames = principal.FindAll("roles").Select(claim => claim.Value).ToList();
        var roles = roleNames.Select(name => Enum.TryParse<Role>(name, out var role) ? role : (Role?)null).OfType<Role>().ToHashSet();
        if (roles.Count != roleNames.Count)
        {
            Revoke(context);
            return;
        }
        http.Items[CurrentActor.ActorKey] = new AuthenticatedActor(
            long.Parse(subject!),
            principal.FindFirstValue("username") ?? "",
            roles,
            RolePermissions.ForRoles(roles),
            principal.FindFirstValue("employeeId"),
            principal.FindFirstValue("customerId"),
            principal.FindFirstValue("displayName"));
    }

    private static void Revoke(TokenValidatedContext context)
    {
        context.HttpContext.Items[RevokedKey] = true;
        context.Fail("AUTH_TOKEN_REVOKED");
    }
}

/// <summary>Giữ thứ tự kiểm URL của hai SecurityFilterChain Java, kể cả khi không có endpoint hoặc sai method.</summary>
public sealed class SpringSecurityBoundaryMiddleware(RequestDelegate next, IReadOnlySet<string> uiPaths, bool development)
{
    private static readonly HashSet<string> PublicApiPaths = new(StringComparer.Ordinal)
    {
        "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout",
        "/api/v1/auth/mobile/login", "/api/v1/auth/mobile/refresh", "/api/v1/auth/mobile/logout",
        "/api/v1/auth/mobile/otp", "/api/v1/auth/mobile/register", "/api/v1/auth/mobile/password-reset",
        "/api/v1/portal/lookup",
    };

    private static readonly string[] PublicStaticPrefixes = ["/pages", "/css", "/js", "/images", "/fonts", "/assets"];

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        var value = path.Value ?? "";
        if (path.StartsWithSegments("/api", StringComparison.Ordinal))
        {
            var anonymous = PublicApiPaths.Contains(value)
                || (HttpMethods.IsGet(context.Request.Method) && value == "/api/v1/portal/catalog")
                || (HttpMethods.IsPost(context.Request.Method) && value == "/api/v1/portal/warranty-requests");
            var hasBearer = context.Request.Headers.Authorization.ToString().StartsWith("Bearer", StringComparison.OrdinalIgnoreCase);
            // Spring từ chối bearer không hợp lệ ngay cả trên URL permitAll.
            if (context.User.Identity?.IsAuthenticated != true && (!anonymous || hasBearer))
            {
                await context.ChallengeAsync();
                return;
            }
        }
        else if (!uiPaths.Contains(value)
            && value != "/actuator/health" && value != "/favicon.ico"
            && !(development && value == "/openapi/v1.json")
            && !(value.EndsWith(".html", StringComparison.Ordinal) && value.IndexOf('/', 1) < 0)
            && !PublicStaticPrefixes.Any(prefix => path.StartsWithSegments(prefix, StringComparison.Ordinal)))
        {
            // staticSecurity Java denyAll, kể cả info/liveness/readiness: 403 không body.
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        await next(context);
    }
}

/// <summary>
/// Tài khoản bị buộc đổi mật khẩu (mật khẩu tạm, D-076) chỉ được gọi các API đổi mật khẩu / đăng xuất / xem mình; còn lại
/// 403 AUTH_PASSWORD_CHANGE_REQUIRED.
/// </summary>
public sealed class PasswordChangeRequiredMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> Allowed =
    [
        "/api/v1/auth/me",
        "/api/v1/auth/change-password",
        "/api/v1/auth/logout",
        "/api/v1/auth/mobile/change-password",
        "/api/v1/auth/mobile/logout",
    ];

    public async Task InvokeAsync(HttpContext context, CurrentActor actors, SecurityVersionCache versions)
    {
        if (actors.Actor is { } actor
            && !Allowed.Contains(context.Request.Path.Value ?? "")
            && (await versions.GetAsync(actor.AccountId.ToString()!)).MustChangePassword)
        {
            await ProblemWriter.WriteAsync(context, ErrorCode.AUTH_PASSWORD_CHANGE_REQUIRED);
            return;
        }
        await next(context);
    }
}

/// <summary>
/// Chống CSRF cho hai endpoint dùng cookie refresh (POST /auth/refresh, /auth/logout): bắt buộc header
/// X-Requested-With: fetch và Origin (nếu có) thuộc danh sách cho phép hoặc chính máy chủ.
/// </summary>
public sealed class RefreshCookieProtectionMiddleware(RequestDelegate next, IOptions<SecurityOptions> options)
{
    private readonly IReadOnlySet<string> allowedOrigins = options.Value.Origins;

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value;
        if (HttpMethods.IsPost(context.Request.Method) && (path == "/api/v1/auth/refresh" || path == "/api/v1/auth/logout"))
        {
            var origin = context.Request.Headers.Origin.ToString();
            if (context.Request.Headers["X-Requested-With"] != "fetch"
                || (origin.Length > 0 && !allowedOrigins.Contains(origin) && origin != OwnOrigin(context.Request)))
            {
                await ProblemWriter.WriteAsync(context, ErrorCode.ACCESS_DENIED);
                return;
            }
        }
        await next(context);
    }

    private static string OwnOrigin(HttpRequest request) => request.Scheme + "://" + request.Host.Value;
}
