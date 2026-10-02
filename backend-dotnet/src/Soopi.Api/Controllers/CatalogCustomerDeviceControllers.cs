using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Soopi.Api.DTOs.Shared;
using Soopi.Api.Services.Catalog;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Devices;

namespace Soopi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/catalog")]
public sealed class CatalogController(CatalogService catalog) : ControllerBase
{
    [HttpGet("{type}")]
    public Task<List<Dictionary<string, object?>>> List(string type) => catalog.ListAsync(type);

    [HttpGet("{type}/{code}")]
    public Task<Dictionary<string, object?>> Get(string type, string code) => catalog.GetAsync(type, code);

    [HttpPost("{type}")]
    public async Task<IActionResult> Create(string type, [FromBody] Dictionary<string, JsonElement> body) =>
        StatusCode(StatusCodes.Status201Created, await catalog.CreateAsync(type, body));

    [HttpPut("{type}/{code}")]
    public Task<Dictionary<string, object?>> Update(string type, string code, [FromBody] Dictionary<string, JsonElement> body) =>
        catalog.UpdateAsync(type, code, body);
}

[ApiController]
[Authorize]
[Route("api/v1/customers")]
public sealed class CustomersController(CustomerService customers, DeviceService devices) : ControllerBase
{
    [HttpGet]
    public Task<PageResponse<CustomerView>> Search([FromQuery] string? q, [FromQuery] int page = 0, [FromQuery] int size = 25) =>
        customers.SearchAsync(q, page, size);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest body) =>
        StatusCode(StatusCodes.Status201Created, await customers.CreateAsync(body.FullName, body.Phone, body.Email, body.Address));

    [HttpGet("{code}")]
    public Task<CustomerView> Get(string code) => customers.GetAsync(code);

    [HttpPatch("{code}/contact")]
    public Task<CustomerView> UpdateContact(string code, [FromBody] UpdateContactRequest body) => customers.UpdateContactAsync(code, body);

    [HttpPost("{code}/archive")]
    public Task<CustomerView> Archive(string code) => customers.ArchiveAsync(code);

    [HttpPost("{code}/merge")]
    public Task<CustomerView> Merge(string code, [FromBody] MergeCustomerRequest body) => customers.MergeAsync(code, body.TargetCode);

    [HttpGet("{customerCode}/devices")]
    public Task<List<DeviceView>> Devices(string customerCode) => devices.ListForCustomerAsync(customerCode);
}

[ApiController]
[Authorize]
[Route("api/v1/devices")]
public sealed class DevicesController(DeviceService devices) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterDeviceRequest body) =>
        StatusCode(StatusCodes.Status201Created, await devices.RegisterAsync(body));

    [HttpGet("lookup")]
    public Task<DeviceView> Lookup([FromQuery] string serial) => devices.LookupAsync(serial);
}
