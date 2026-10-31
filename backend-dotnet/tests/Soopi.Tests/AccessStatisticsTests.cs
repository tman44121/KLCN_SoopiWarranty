using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Soopi.Api.Controllers;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Reporting;

namespace Soopi.Tests;

public class AccessStatisticsTests
{
    private static CurrentActor Actor(Role? role, string? sid = null)
    {
        var http = new DefaultHttpContext();
        if (role is { } r) http.Items["soopi.actor"] = new AuthenticatedActor(1, "test", new HashSet<Role> { r }, RolePermissions.ForRole(r), null, null, "Test");
        else http.Items["soopi.portal"] = new PortalGrant(PortalScope.TICKET, "TN-TEST");
        if (sid is not null) http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sid", sid)]));
        return new CurrentActor(new HttpContextAccessor { HttpContext = http });
    }

    [Theory]
    [InlineData(Role.CUSTOMER)] [InlineData(Role.RECEPTIONIST)] [InlineData(Role.DISPATCHER)]
    [InlineData(Role.TECHNICIAN)] [InlineData(Role.CASHIER)] [InlineData(Role.WAREHOUSE_KEEPER)]
    public async Task StatisticsAreAdminOnlyEvenWhenAnotherRoleHasAuditPermission(Role role)
    {
        var stats = new AccessStatisticsService(null!, Actor(role), null!, TimeProvider.System);
        await Denied(() => stats.SummaryAsync(new())); await Denied(() => stats.OnlineAsync(new(), 0, 25));
        await Denied(() => stats.LogsAsync(new(), null, 0, 25)); await Denied(() => stats.ExportAsync(new(), null));
    }
    private static async Task Denied(Func<Task> call) => Assert.Equal(ErrorCode.ACCESS_DENIED, (await Assert.ThrowsAsync<DomainException>(call)).Code);

    [Fact]
    public async Task TrackingRequiresAnAccountAndASignedSession()
    {
        await Denied(() => new AccessTrackingService(null!, Actor(null), null!, TimeProvider.System).HeartbeatAsync());
        Assert.False(await new AccessTrackingService(null!, Actor(Role.CUSTOMER), null!, TimeProvider.System).HeartbeatAsync());
        Assert.Null(Actor(Role.CUSTOMER, "client-can-choose-this").SessionId);
        var sid = Guid.NewGuid(); Assert.Equal(sid.ToString(), Actor(Role.CUSTOMER, sid.ToString().ToUpperInvariant()).SessionId);
    }

    [Fact]
    public async Task ValidatesFiltersAndPagingBeforeReadingDatabase()
    {
        var stats = new AccessStatisticsService(null!, Actor(Role.ADMIN), null!, TimeProvider.System);
        foreach (var filter in new[] { new AccessFilters(Q: new string('x', 101)), new AccessFilters(Kind: "ANONYMOUS"), new AccessFilters(Role: "999"), new AccessFilters(Role: "0"),
            new AccessFilters(Role: "ADMIN' OR 1=1"), new AccessFilters(To: DateOnly.MaxValue), new AccessFilters(new(2026, 11, 2), new(2026, 11, 1)) })
            Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => stats.SummaryAsync(filter))).Code);
        foreach (var (page, size) in new[] { (-1, 25), (0, 1), (int.MaxValue, 100) })
            Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => stats.OnlineAsync(new(), page, size))).Code);
        Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => stats.LogsAsync(new(), "DELETE_ALL", 0, 25))).Code);
        Assert.Equal("ADMIN", Assert.Single(typeof(AccessStatisticsController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Roles);
    }

    [Fact]
    public void AccessWorkbookPreservesHistoricalDaysAndTreatsNamesAsText()
    {
        var start = new DateOnly(2026, 10, 31); var next = start.AddDays(1);
        var data = new AccessSummary(start, start, next, DateTimeOffset.UtcNow, 20, 10, 3, 1, 4, 2,
            [new(start, 4, 2, 1, 0), new(next, 6, 2, 3, 2)]);
        using var memory = new MemoryStream(ReportWorkbook.CreateAccess(data, [new("1", DateTimeOffset.UtcNow, "1", "=SUM(A1)", "<script>🌟", "CUSTOMER", "CUSTOMER", "AUTH_LOGIN_SUCCESS", "Đăng nhập")]));
        using var zip = new ZipArchive(memory);
        string Read(string path) { using var reader = new StreamReader(zip.GetEntry(path)!.Open(), Encoding.UTF8); return reader.ReadToEnd(); }
        Assert.Contains("Nhật ký đăng nhập", Read("xl/workbook.xml"));
        Assert.Contains("01/11/2026", Read("xl/worksheets/sheet2.xml"));
        var logSheet = Read("xl/worksheets/sheet3.xml"); Assert.Contains("=SUM(A1)", logSheet); Assert.DoesNotContain("<f>", logSheet); Assert.Contains("&lt;script&gt;", logSheet);
    }
}
