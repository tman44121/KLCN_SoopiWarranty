using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Soopi.Api.Controllers;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Portal;

namespace Soopi.Tests;

public class PublicReviewTests
{
    private static PublicReviewService Service(Role role)
    {
        var http = new DefaultHttpContext();
        http.Items["soopi.actor"] = new AuthenticatedActor(1, "test", new HashSet<Role> { role }, RolePermissions.ForRole(role), null, null, "Test");
        return new(null!, new CurrentActor(new HttpContextAccessor { HttpContext = http }), null!, null!, TimeProvider.System);
    }

    [Theory]
    [InlineData(Role.CUSTOMER)] [InlineData(Role.RECEPTIONIST)] [InlineData(Role.TECHNICIAN)]
    [InlineData(Role.DISPATCHER)] [InlineData(Role.CASHIER)] [InlineData(Role.WAREHOUSE_KEEPER)]
    public async Task OnlyAdminCanPublishOrHideEvenWithOtherStaffPermissions(Role role)
    {
        foreach (var publish in new[] { true, false })
            Assert.Equal(ErrorCode.ACCESS_DENIED, (await Assert.ThrowsAsync<DomainException>(() => Service(role).SetPublicationAsync("TN1", publish, 5, DateTimeOffset.UtcNow, "Tốt"))).Code);
    }

    [Fact]
    public async Task ApprovalRequiresAValidSnapshotOfTheReview()
    {
        var service = Service(Role.ADMIN);
        foreach (var request in new[] { new ReviewPublicationRequest(null), new(true), new(true, 0, DateTimeOffset.UtcNow), new(true, 6, DateTimeOffset.UtcNow),
            new(true, 5, null), new(true, 5, DateTimeOffset.UtcNow, new string('x', 1001)) })
            Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => service.SetPublicationAsync("TN1", request.Published, request.Rating, request.RatedAt, request.Comment))).Code);
    }

    [Fact]
    public void PublicPayloadHasNoCustomerTicketDeviceOrEmployeeIdentity()
    {
        Assert.Equal(new[] { "Comment", "Id", "Rating", "ReviewedOn" }, typeof(PublicReview).GetProperties().Select(p => p.Name).OrderBy(n => n).ToArray());
        Assert.NotNull(typeof(PublicReviewsController).GetMethod("List")!.GetCustomAttributes(typeof(AllowAnonymousAttribute), true).SingleOrDefault());
        Assert.Equal("ADMIN", ((AuthorizeAttribute)typeof(ReviewPublicationController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Single()).Roles);
    }
}
