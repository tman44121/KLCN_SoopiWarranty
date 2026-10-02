using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Domain.Identity;
using Soopi.Api.DTOs.Identity;
using Soopi.Api.Services.Identity;

namespace Soopi.Api.Controllers.Identity;

[ApiController]
[Authorize]
[Route("api/v1/admin/employees")]
public sealed class AdminEmployeesController(EmployeeAdminService employees) : ControllerBase
{
    [HttpGet]
    public Task<List<EmployeeAccountView>> List([FromQuery] string? q, [FromQuery] Role? role, [FromQuery] string? status) =>
        employees.ListAsync(q, role, status);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EmployeeCreateRequest body) =>
        StatusCode(StatusCodes.Status201Created, await employees.CreateAsync(body));

    [HttpPatch("{code}")]
    public Task<EmployeeAccountView> Update(string code, [FromBody] EmployeeUpdateRequest body) => employees.UpdateAsync(code, body);

    [HttpPut("{code}/roles")]
    public Task<EmployeeAccountView> ChangeRoles(string code, [FromBody] RolesRequest body) => employees.ChangeRolesAsync(code, body.Roles);

    [HttpPost("{code}/lock")]
    public Task<EmployeeAccountView> Lock(string code) => employees.LockAsync(code);

    [HttpPost("{code}/unlock")]
    public Task<EmployeeAccountView> Unlock(string code) => employees.UnlockAsync(code);

    /// <summary>Mật khẩu tạm chỉ trả về đúng một lần trong response này.</summary>
    [HttpPost("{code}/reset-password")]
    public async Task<Dictionary<string, string>> ResetPassword(string code) =>
        new() { ["temporaryPassword"] = await employees.ResetPasswordAsync(code) };
}
