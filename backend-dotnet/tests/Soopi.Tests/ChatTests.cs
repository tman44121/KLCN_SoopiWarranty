using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Soopi.Api.Controllers;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Chat;

namespace Soopi.Tests;

public class ChatTests
{
    private static bool Valid(object body)
    {
        var services = new ServiceCollection();
        services.AddLogging(); services.AddControllers();
        using var provider = services.BuildServiceProvider();
        var context = new ActionContext(new DefaultHttpContext { RequestServices = provider }, new RouteData(), new ActionDescriptor());
        provider.GetRequiredService<IObjectModelValidator>().Validate(context, null, "", body);
        return context.ModelState.IsValid;
    }

    [Fact]
    public void MessageValidationUsesMvcRecordMetadata()
    {
        var nonce = Guid.NewGuid().ToString();
        Assert.True(Valid(new SendChatRequest(new string('a', 1998) + "🌟", nonce)));
        Assert.False(Valid(new SendChatRequest(new string('a', 2001), nonce)));
        Assert.False(Valid(new SendChatRequest(" \r\n ", nonce)));
        Assert.False(Valid(new SendChatRequest(null!, nonce)));
        Assert.False(Valid(new StartChatRequest("", "1")));
        Assert.False(Valid(new ReadChatRequest(null!)));
    }

    private static ChatService Service(bool signedIn)
    {
        var http = new DefaultHttpContext();
        if (signedIn) http.Items["soopi.actor"] = new AuthenticatedActor(1, "test", new HashSet<Role> { Role.CUSTOMER },
            RolePermissions.ForRole(Role.CUSTOMER), null, "KH-TEST", "Test");
        else http.Items["soopi.portal"] = new PortalGrant(PortalScope.TICKET, "TN-TEST");
        return new ChatService(null!, new CurrentActor(new HttpContextAccessor { HttpContext = http }), null!, TimeProvider.System);
    }

    [Fact]
    public async Task LookupPortalTokenCannotUsePrivateChat()
    {
        Assert.Equal(ErrorCode.ACCESS_DENIED, (await Assert.ThrowsAsync<DomainException>(() => Service(false).ContactsAsync(null, 0))).Code);
        Assert.Equal(ErrorCode.ACCESS_DENIED, (await Assert.ThrowsAsync<DomainException>(() => Service(false).MessagesAsync("1", null))).Code);
    }

    [Fact]
    public async Task DirectoryRejectsInvalidSearchAndPagination()
    {
        foreach (var (q, page) in new[] { (new string('a', 101), 0), ("", -1), ("", int.MaxValue) })
            Assert.Equal(ErrorCode.VALIDATION_FAILED, (await Assert.ThrowsAsync<DomainException>(() => Service(true).ContactsAsync(q, page))).Code);
        foreach (var id in new[] { "-1", "0", "1 OR 1=1", "9223372036854775808" })
            Assert.Equal(ErrorCode.NOT_FOUND, (await Assert.ThrowsAsync<DomainException>(() => Service(true).MessagesAsync(id, null))).Code);
    }
}
