using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Domain.Shared;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Identity;

namespace Soopi.Api.Controllers.Identity;

/// <summary>Xác thực web: access token trong body, refresh token trong cookie HttpOnly LML_RT (Path /api/v1/auth).</summary>
[ApiController]
[Authorize]
[Route("api/v1/auth")]
public sealed class AuthController(AuthService auth, CurrentActor actors) : ControllerBase
{
    private const string Cookie = "LML_RT";
    private const string CookiePath = "/api/v1/auth";

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<AuthResponse> Login([FromBody] LoginRequest body) =>
        Respond(await auth.LoginAsync(body.Username, body.Password, body.Remember, actors.ClientIp, actors.UserAgent));

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<AuthResponse> Refresh()
    {
        var token = Request.Cookies[Cookie];
        if (string.IsNullOrWhiteSpace(token)) throw new DomainException(ErrorCode.AUTH_TOKEN_INVALID);
        return Respond(await auth.RefreshAsync(token, actors.ClientIp, actors.UserAgent));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout([FromQuery] bool all = false)
    {
        await auth.LogoutAsync(Request.Cookies[Cookie], all);
        Response.Cookies.Append(Cookie, "", Options(TimeSpan.Zero));
        return NoContent();
    }

    [HttpGet("me")]
    public Task<UserView> Me() => auth.MeAsync(actors.Current);

    [HttpPost("change-password")]
    public async Task<AuthResponse> ChangePassword([FromBody] ChangePasswordRequest body) =>
        Respond(await auth.ChangePasswordAsync(
            actors.Current, body.CurrentPassword, body.NewPassword, false, actors.ClientIp, actors.UserAgent));

    private AuthResponse Respond(AuthResult result)
    {
        Response.Cookies.Append(Cookie, result.RefreshToken, Options(result.Remember ? TimeSpan.FromSeconds(result.RefreshMaxAge) : null));
        return AuthResponse.From(result);
    }

    /// <summary>maxAge null = cookie phiên (không "ghi nhớ"); 0 = xóa cookie.</summary>
    private static CookieOptions Options(TimeSpan? maxAge)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = CookiePath,
            MaxAge = maxAge,
        };
        if (maxAge == TimeSpan.Zero) options.Expires = DateTimeOffset.UnixEpoch;
        return options;
    }
}

/// <summary>
/// Xác thực cho app di động khách hàng: refresh token đi trong body thay cho cookie của web. Các endpoint đăng ký/đăng nhập
/// chỉ nhận tài khoản khách.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/auth/mobile")]
public sealed class MobileAuthController(
    AuthService auth,
    CustomerAccountService customerAccounts,
    Services.Notifications.PushDeviceService pushDevices,
    CurrentActor actors) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<MobileAuthResponse> Login([FromBody] MobileLoginBody body) =>
        MobileAuthResponse.From(await auth.LoginCustomerAsync(body.Username, body.Password, actors.ClientIp, actors.UserAgent));

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<MobileAuthResponse> Refresh([FromBody] RefreshBody body) =>
        MobileAuthResponse.From(await auth.RefreshAsync(body.RefreshToken, actors.ClientIp, actors.UserAgent));

    /// <summary>Luôn 204: đăng xuất không được để lộ refresh token nào còn hiệu lực.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout([FromBody] LogoutBody body)
    {
        if (await auth.LogoutAsync(body.RefreshToken, body.All) is { } accountId)
            await pushDevices.ForgetAsync(body.InstallationId, accountId);
        return NoContent();
    }

    [HttpPost("change-password")]
    public async Task<MobileAuthResponse> ChangePassword([FromBody] ChangePasswordRequest body) =>
        MobileAuthResponse.From(await auth.ChangePasswordAsync(
            actors.Current, body.CurrentPassword, body.NewPassword, true, actors.ClientIp, actors.UserAgent));

    [HttpPost("otp")]
    [AllowAnonymous]
    public async Task<IActionResult> RequestOtp([FromBody] OtpBody body) =>
        StatusCode(StatusCodes.Status202Accepted, await customerAccounts.RequestOtpAsync(body.Phone, body.Purpose, actors.ClientIp));

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterBody body) =>
        StatusCode(StatusCodes.Status201Created, MobileAuthResponse.From(await customerAccounts.RegisterAsync(
            new RegisterCommand(body.Phone, body.Otp, body.FullName, body.Password, body.Email), actors.ClientIp, actors.UserAgent)));

    [HttpPost("password-reset")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] PasswordResetBody body)
    {
        await customerAccounts.ResetPasswordAsync(body.Phone, body.Otp, body.NewPassword);
        return NoContent();
    }
}
