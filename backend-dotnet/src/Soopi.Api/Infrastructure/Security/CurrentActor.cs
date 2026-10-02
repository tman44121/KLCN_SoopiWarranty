using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Infrastructure.Security;

/// <summary>
/// Người dùng của request (tài khoản đăng nhập hoặc portal token), do JwtBearer dựng ở <see cref="AuthSetup"/>. Kiểm quyền
/// ở tầng service như @PreAuthorize("hasAuthority('PERM_…')") của bản Java: thiếu quyền → 403 ACCESS_DENIED.
/// </summary>
public sealed class CurrentActor(IHttpContextAccessor http)
{
    internal const string ActorKey = "soopi.actor";
    internal const string PortalKey = "soopi.portal";

    public AuthenticatedActor? Actor => http.HttpContext?.Items[ActorKey] as AuthenticatedActor;

    public PortalGrant? PortalGrant => http.HttpContext?.Items[PortalKey] as PortalGrant;

    public AuthenticatedActor Current => Actor ?? throw new DomainException(ErrorCode.AUTH_TOKEN_INVALID);

    /// <summary>Cần ít nhất một trong các quyền.</summary>
    public AuthenticatedActor Require(params Permission[] anyOf)
    {
        if (Actor is { } actor && anyOf.Any(actor.Permissions.Contains)) return actor;
        throw new DomainException(ErrorCode.ACCESS_DENIED);
    }

    /// <summary>Như hasAnyAuthority('PERM_…', 'PORTAL_TOKEN'): tài khoản có quyền hoặc portal token.</summary>
    public void RequireOrPortal(params Permission[] anyOf)
    {
        if (PortalGrant is not null) return;
        Require(anyOf);
    }

    /// <summary>Đăng nhập bằng tài khoản (không nhận portal token).</summary>
    public AuthenticatedActor RequireSignedIn() => Actor ?? throw new DomainException(ErrorCode.ACCESS_DENIED);

    public string? ClientIp => http.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public string? UserAgent => http.HttpContext?.Request.Headers.UserAgent.ToString() is { Length: > 0 } agent ? agent : null;
}
