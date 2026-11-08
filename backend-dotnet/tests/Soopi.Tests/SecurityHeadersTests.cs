using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Soopi.Api.Infrastructure;

namespace Soopi.Tests;

public class SecurityHeadersTests
{
    private sealed class Env : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "Soopi";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class Response : HttpResponseFeature
    {
        public readonly List<(Func<object, Task> Callback, object State)> Starting = [];
        public override void OnStarting(Func<object, Task> callback, object state) => Starting.Add((callback, state));
    }

    /// <summary>Font tự host ở /fonts; CSP chặn chúng thì tiếng Việt rơi về font hệ thống và dấu bị lệch (lỗi 08/11/2026).</summary>
    [Fact]
    public async Task Csp_AllowsSelfHostedFonts()
    {
        var context = new DefaultHttpContext();
        var response = new Response();
        context.Features.Set<IHttpResponseFeature>(response);
        await new SecurityHeadersMiddleware(_ => Task.CompletedTask, new Env()).InvokeAsync(context);
        foreach (var (callback, state) in response.Starting) await callback(state);

        var csp = context.Response.Headers.ContentSecurityPolicy.ToString();
        var fontSrc = csp.Split(';').Select(part => part.Trim()).Single(part => part.StartsWith("font-src "));
        Assert.Contains("'self'", fontSrc.Split(' '));
    }
}
