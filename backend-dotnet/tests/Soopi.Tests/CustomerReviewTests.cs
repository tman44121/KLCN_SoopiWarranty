using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Soopi.Api.Controllers;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Portal;
using Soopi.Api.Services.Reporting;

namespace Soopi.Tests;

public class CustomerReviewTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(5, true)]
    [InlineData(6, false)]
    public void Rating_ValidatesThroughMvcWithoutRecordMetadataException(int? rating, bool valid)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        using var provider = services.BuildServiceProvider();
        bool Validate(string? comment)
        {
            var context = new ActionContext(new DefaultHttpContext { RequestServices = provider }, new RouteData(), new ActionDescriptor());
            provider.GetRequiredService<IObjectModelValidator>().Validate(context, null, "", new TicketRatingRequest(rating, comment));
            return context.ModelState.IsValid;
        }
        Assert.Equal(valid, Validate(null));
        Assert.Equal(valid, Validate(new string('a', 1000)));
        Assert.False(Validate(new string('a', 1001)));
    }

    private static ReportService Reports(Role role)
    {
        var context = new DefaultHttpContext();
        context.Items["soopi.actor"] = new AuthenticatedActor(1, "test", new HashSet<Role> { role }, RolePermissions.ForRole(role), null, null, "test");
        return new ReportService(null!, new CurrentActor(new HttpContextAccessor { HttpContext = context }), TimeProvider.System, new ConfigurationBuilder().Build());
    }

    [Theory]
    [InlineData(Role.CUSTOMER)]
    [InlineData(Role.RECEPTIONIST)]
    [InlineData(Role.DISPATCHER)]
    [InlineData(Role.TECHNICIAN)]
    [InlineData(Role.CASHIER)]
    [InlineData(Role.WAREHOUSE_KEEPER)]
    public async Task ReviewReport_RejectsEveryNonAdminRole(Role role) =>
        Assert.Equal(ErrorCode.ACCESS_DENIED, (await Assert.ThrowsAsync<DomainException>(() => Reports(role).CustomerReviewsAsync(null, null, null, null, null, 0, 25))).Code);

    [Fact]
    public async Task ReviewReport_ValidatesFiltersBeforeDatabaseAccess()
    {
        var reports = Reports(Role.ADMIN);
        Assert.Equal("ADMIN", Assert.Single(typeof(ReportsController).GetMethod(nameof(ReportsController.CustomerReviews))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Roles);
        foreach (var (rating, page, size) in new[] { (0, 0, 25), (6, 0, 25), (5, -1, 25), (5, 0, 10), (5, int.MaxValue, 25) })
            Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => reports.CustomerReviewsAsync(null, null, null, rating, null, page, size))).Code);
        Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => reports.CustomerReviewsAsync(new DateOnly(2026, 10, 22), new DateOnly(2026, 10, 21), null, null, null, 0, 25))).Code);
    }
}
