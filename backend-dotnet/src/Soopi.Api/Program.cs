using System.Globalization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure;
using Soopi.Api.Infrastructure.Errors;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Billing;
using Soopi.Api.Services.Catalog;
using Soopi.Api.Services.Inventory;
using Soopi.Api.Services.Quotations;
using Soopi.Api.Services.Reporting;
using Soopi.Api.Services.Customers;
using Soopi.Api.Services.Devices;
using Soopi.Api.Services.Files;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.WarrantyRequests;
using Soopi.Api.Services.Identity;
using Soopi.Api.Services.Notifications;
using Soopi.Api.Services.Shared;
using Soopi.Api.Services.Tickets;

// Số trong chuỗi nhật ký/thông báo không phụ thuộc culture của máy chủ (như BigDecimal.toString của Java).
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

const long MaxRequestBytes = 100L * 1024 * 1024;
builder.WebHost.ConfigureKestrel(kestrel => kestrel.Limits.MaxRequestBodySize = MaxRequestBytes);
builder.Services.Configure<FormOptions>(form => form.MultipartBodyLengthLimit = MaxRequestBytes);

builder.Services.AddDbContext<AppDbContext>(options => options
    .UseSqlServer(config.GetConnectionString("Default"))
    .AddInterceptors(new LockTimeoutInterceptor()));
builder.Services.AddScoped<Sql>();
builder.Services.AddScoped<TransactionRunner>();
builder.Services.AddScoped<CodeGenerator>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

// Dùng chung: nhật ký, thông báo, push (chế độ log).
if (config["Push:Provider"] is { } push && push != "log")
    throw new InvalidOperationException($"Push:Provider={push} chưa được hỗ trợ ở bản .NET — dùng \"log\"");
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<PushDispatcher>();
builder.Services.AddScoped<PushDeviceStore>();
builder.Services.AddSingleton<IPushGateway, LoggingPushGateway>();

// Xác thực và tài khoản.
if (config["Sms:Provider"] is { } sms && sms != "log")
    throw new InvalidOperationException($"Sms:Provider={sms} chưa được hỗ trợ ở bản .NET — dùng \"log\"");
builder.Services.Configure<SecurityOptions>(config.GetSection("Security"));
builder.Services.AddSingleton<JwtKeys>();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<SecurityVersionCache>();
builder.Services.AddSingleton<RateLimiter>();
builder.Services.AddSingleton<PasswordPolicy>();
builder.Services.AddSingleton<ISmsSender, LoggingSmsSender>();
builder.Services.AddScoped<CurrentActor>();
builder.Services.AddScoped<AccountStore>();
builder.Services.AddScoped<PrincipalDirectory>();
builder.Services.AddScoped<EmployeeRecordStore>();
builder.Services.AddScoped<CustomerProfileStore>();
builder.Services.AddScoped<OtpStore>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AccountPolicy>();
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<CustomerAccountService>();
builder.Services.AddScoped<EmployeeAdminService>();
builder.Services.AddScoped<PushDeviceService>();
builder.Services.AddHostedService<RefreshTokenCleanup>();

// Danh mục, khách hàng, thiết bị.
builder.Services.AddScoped<CatalogStore>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<ProductCatalog>();
builder.Services.AddScoped<CustomerService>();
builder.Services.AddScoped<CustomerAccountAdminService>();
builder.Services.AddScoped<DeviceService>();

// Yêu cầu online, cổng khách hàng, tệp đính kèm.
builder.Services.AddScoped<FileStorage>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddScoped<WarrantyRequestStore>();
builder.Services.AddScoped<WarrantyRequestService>();
builder.Services.AddScoped<WarrantyRequestSubmissionService>();
builder.Services.AddScoped<PortalPolicy>();
builder.Services.AddScoped<PortalAccessService>();
builder.Services.AddScoped<PortalWarrantyRequestService>();
builder.Services.AddScoped<PortalProfileService>();

// Phiếu tiếp nhận.
builder.Services.AddScoped<TicketStore>();
builder.Services.AddScoped<StaffDirectory>();
builder.Services.AddScoped<TicketQueryService>();
builder.Services.AddScoped<ReceptionService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<InspectionService>();
builder.Services.AddScoped<RepairService>();
builder.Services.AddScoped<TicketNoteService>();
builder.Services.AddScoped<TechnicianQueryService>();
builder.Services.AddScoped<GlobalSearchService>();

// Báo giá, kho, thu ngân, bàn giao, phiếu trên portal.
builder.Services.AddScoped<QuotationStore>();
builder.Services.AddScoped<QuotationService>();
builder.Services.AddScoped<QuotationReviewService>();
builder.Services.AddScoped<CustomerDecisionService>();
builder.Services.AddScoped<InventoryStore>();
builder.Services.AddScoped<InventoryDocumentStore>();
builder.Services.AddScoped<PartQueryService>();
builder.Services.AddScoped<LowStockNotifier>();
builder.Services.AddScoped<StockIssueService>();
builder.Services.AddScoped<StockReceiptService>();
builder.Services.AddScoped<StockTransferService>();
builder.Services.AddScoped<IssuedParts>();
builder.Services.AddScoped<BillingCalculator>();
builder.Services.AddScoped<BillingQueryService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<HandoverService>();
builder.Services.AddScoped<PortalTicketService>();

// Báo cáo, nhật ký, thông báo, job SLA.
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<AuditQueryService>();
builder.Services.AddScoped<NotificationQueryService>();
builder.Services.AddHostedService<SlaAlertJob>();
builder.Services.AddSoopiAuthentication();

builder.Services
    .AddControllers(options =>
    {
        // Chỉ các ràng buộc khai báo tường minh (NotBlank, NotNull…) như Bean Validation, không tự thêm Required.
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
        options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider());
    })
    .AddJsonOptions(options => JsonSetup.Apply(options.JsonSerializerOptions))
    .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = ValidationProblems.Create);
builder.Services.ConfigureHttpJsonOptions(options => JsonSetup.Apply(options.SerializerOptions));
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

var allowedOrigins = (config["Security:AllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy => policy
    .WithOrigins(allowedOrigins)
    .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    .WithHeaders("Authorization", "Content-Type", "If-Match", "X-Requested-With", CorrelationIdMiddleware.Header)
    .WithExposedHeaders(CorrelationIdMiddleware.Header)
    .AllowCredentials()));

var app = builder.Build();

var pages = new Dictionary<string, string>
{
    ["/login.html"] = "/login", ["/index.html"] = "/dispatch",
    ["/pages/receptionist.html"] = "/receptionist", ["/pages/technician.html"] = "/technician",
    ["/pages/warehouse.html"] = "/warehouse", ["/pages/cashier.html"] = "/cashier",
    ["/pages/tickets.html"] = "/tickets", ["/pages/reports.html"] = "/reports",
    ["/pages/admin.html"] = "/admin", ["/pages/customer-portal.html"] = "/portal",
    // URL cũ của web khách KLCN (Thymeleaf).
    ["/Account/Register"] = "/register", ["/Account/Profile"] = "/account",
    ["/Account/ForgotPassword"] = "/forgot-password",
};

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseExceptionHandler();
// Lỗi routing/MVC → Problem Details như Java; staticSecurity denyAll vẫn trả 403 không body.
app.UseStatusCodePages(async context =>
{
    var http = context.HttpContext;
    if (http.Response.StatusCode is < 400 or >= 500
        || (!http.Request.Path.StartsWithSegments("/api", StringComparison.Ordinal) && http.Response.StatusCode == 403)) return;
    var code = http.Response.StatusCode switch
    {
        404 => ErrorCode.NOT_FOUND,
        401 => ErrorCode.AUTH_TOKEN_INVALID,
        403 => ErrorCode.ACCESS_DENIED,
        _ => ErrorCode.VALIDATION_FAILED,
    };
    await ProblemWriter.WriteAsync(http, code, status: http.Response.StatusCode);
});
if (app.Environment.IsProduction())
{
    // Sau reverse proxy (bản Java: server.forward-headers-strategy=framework): IP thật của client cho rate limit/nhật ký.
    var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
    forwarded.KnownIPNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
}
app.UseStaticFiles();
app.UseCors();
app.UseMiddleware<RefreshCookieProtectionMiddleware>();
app.UseAuthentication();
app.UseMiddleware<SpringSecurityBoundaryMiddleware>(
    pages.Keys.Concat(pages.Values).Append("/").ToHashSet(StringComparer.Ordinal), app.Environment.IsDevelopment());
app.UseMiddleware<PasswordChangeRequiredMiddleware>();
app.UseAuthorization();

if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapControllers();

// Chỉ các URL giao diện trả index.html; /api sai vẫn trả Problem Details.
// "/" là trang giới thiệu công khai cho khách (home/index.html của web khách KLCN).
app.MapFallbackToFile("/", "index.html");
foreach (var (legacy, route) in pages)
{
    app.MapGet(legacy, (HttpContext context) => Results.Redirect(route + context.Request.QueryString, permanent: true));
    app.MapFallbackToFile(route, "index.html");
}

// Giữ shape Spring Actuator (probes groups có trong WAR hiện tại), DB lỗi → 503 DOWN.
app.MapGet("/actuator/health", async (AppDbContext db) =>
{
    var up = await db.Database.CanConnectAsync();
    return Results.Json(new { groups = new[] { "liveness", "readiness" }, status = up ? "UP" : "DOWN" }, statusCode: up ? 200 : 503);
});

app.Run();

public partial class Program;
