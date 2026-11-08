using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Controllers;

/// <summary>Mốc thời gian hệ thống. Đọc công khai (cổng khách cần giờ làm việc), chỉ quản trị viên được sửa.</summary>
[ApiController]
[Route("api/v1/settings/time")]
public sealed class TimeSettingsController(TimeSettingsService settings) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<TimeSettingsBody> Get()
    {
        Response.Headers.CacheControl = "no-store";
        return TimeSettingsBody.From(await settings.GetAsync());
    }

    [HttpPut]
    [Authorize(Roles = "ADMIN")]
    public async Task<TimeSettingsBody> Update([FromBody] TimeSettingsBody body) => TimeSettingsBody.From(await settings.UpdateAsync(body), admin: true);

    [HttpGet("admin")]
    [Authorize(Roles = "ADMIN")]
    public async Task<TimeSettingsBody> Admin()
    {
        Response.Headers.CacheControl = "no-store";
        return TimeSettingsBody.From(await settings.GetAsync(), admin: true);
    }
}
