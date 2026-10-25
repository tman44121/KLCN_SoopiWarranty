using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Soopi.Api.Controllers;

namespace Soopi.Tests;

public class NotificationTests
{
    private static bool Valid(BroadcastRequest request)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        using var provider = services.BuildServiceProvider();
        var context = new ActionContext(new DefaultHttpContext { RequestServices = provider }, new RouteData(), new ActionDescriptor());
        provider.GetRequiredService<IObjectModelValidator>().Validate(context, null, "", request);
        return context.ModelState.IsValid;
    }

    [Fact]
    public void Broadcast_AllowsOnlyAdminAndReceptionist()
    {
        var auth = Assert.Single(typeof(NotificationBroadcastController).GetCustomAttributes(typeof(AuthorizeAttribute), true));
        Assert.Equal("ADMIN,RECEPTIONIST", ((AuthorizeAttribute)auth).Roles);
    }

    [Fact]
    public void Broadcast_ValidatesMessageAndLinkLengthsThroughMvc()
    {
        Assert.True(Valid(new BroadcastRequest(new string('a', 255))));
        Assert.False(Valid(new BroadcastRequest(new string('a', 256))));
        Assert.False(Valid(new BroadcastRequest(" ")));
        Assert.False(Valid(new BroadcastRequest(null!)));
        Assert.False(Valid(new BroadcastRequest("Thông báo", "/" + new string('a', 255))));
    }

    [Theory]
    [InlineData("/account#lich-su", true)]
    [InlineData(null, true)]
    [InlineData(" ", true)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("https://example.com", false)]
    [InlineData("//example.com", false)]
    [InlineData("/\\example.com", false)]
    [InlineData("/\n/example.com", false)]
    public void Broadcast_RequiresLocalLinks(string? link, bool valid) => Assert.Equal(valid, Valid(new BroadcastRequest("Thông báo", link)));

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(",, ,")]
    [InlineData("KH-12345678901234567890")]
    public void Broadcast_ExplicitEmptyOrInvalidSelectionCannotSendToAll(string ids) =>
        Assert.False(Valid(new BroadcastRequest("Thông báo", CustomerIds: ids)));

    [Fact]
    public void Broadcast_SupportsOneOrMultipleCustomersWithoutDuplicates()
    {
        var request = new BroadcastRequest("Thông báo", CustomerId: " KH-01 ", CustomerIds: " KH-01, KH-02,kh-02, ");
        Assert.True(Valid(request));
        Assert.Equal(["KH-01", "KH-02"], request.Recipients());
        Assert.False(Valid(new BroadcastRequest("Thông báo", CustomerId: " ")));
        Assert.True(Valid(new BroadcastRequest("Thông báo")));
    }
}
