using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Identity;

namespace Soopi.Tests;

public class IdentityTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PasswordHasher_VerifiesHashWrittenBySpring()
    {
        // Hash của tài khoản demo "letan" / "1234" trong db/sqlserver/03_demo_data.sql (Spring DelegatingPasswordEncoder).
        const string spring = "{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm";
        Assert.True(PasswordHasher.Matches("1234", spring));
        Assert.False(PasswordHasher.Matches("12345", spring));
        Assert.False(PasswordHasher.Matches("1234", "$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm"));
    }

    [Fact]
    public void PasswordHasher_EncodesWithPrefixForCheckConstraint()
    {
        var encoded = PasswordHasher.Encode("MatKhauMoi2026");
        Assert.StartsWith("{bcrypt}$2", encoded);
        Assert.True(PasswordHasher.Matches("MatKhauMoi2026", encoded));
    }

    [Theory]
    [InlineData("MatKhauMoi2026", true)]
    [InlineData("ngan123", false)]
    [InlineData("chikhongcoso", false)]
    [InlineData("1234567890", false)]
    [InlineData("letan2026abc", false)]
    public void PasswordPolicy_MatchesJavaRules(string password, bool valid)
    {
        var policy = new PasswordPolicy();
        if (valid) policy.Validate("letan", password);
        else Assert.Equal(ErrorCode.AUTH_PASSWORD_POLICY, Assert.Throws<DomainException>(() => policy.Validate("letan", password)).Code);
    }

    [Fact]
    public void Account_LocksTemporarilyAfterFiveFailures()
    {
        var account = Account.Employee("letan", "{bcrypt}x", [Role.RECEPTIONIST], "NV-004", false);
        for (var attempt = 1; attempt < 5; attempt++) Assert.False(account.RegisterFailedLogin(Now, 5, TimeSpan.FromMinutes(15)));
        Assert.True(account.RegisterFailedLogin(Now, 5, TimeSpan.FromMinutes(15)));
        Assert.True(account.TemporarilyLocked(Now.AddMinutes(14)));
        Assert.False(account.TemporarilyLocked(Now.AddMinutes(15)));
        account.RegisterSuccessfulLogin(Now);
        Assert.Equal(0, account.FailedLoginAttempts);
    }

    [Fact]
    public void Account_SecurityChangesBumpVersion()
    {
        var account = Account.Employee("letan", "{bcrypt}x", [Role.CASHIER, Role.RECEPTIONIST], "NV-004", true);
        Assert.Equal([Role.RECEPTIONIST, Role.CASHIER], account.Roles);
        account.ReplaceRoles([Role.DISPATCHER]);
        account.Lock();
        account.Unlock();
        account.ChangePassword("{bcrypt}y", Now);
        Assert.Equal(5, account.SecurityVersion);
        Assert.False(account.MustChangePassword);
        Assert.Equal([Role.DISPATCHER], account.Roles);
        Assert.Throws<DomainException>(() => account.ReplaceRoles([Role.CUSTOMER]));
    }

    [Fact]
    public void UserView_LandingFromFirstRole_PermissionsSorted()
    {
        var account = Account.Employee("letan", "{bcrypt}x", [Role.CASHIER, Role.RECEPTIONIST], "NV-004", false);
        var view = AuthService.View(account, "Lễ tân");
        Assert.Equal("/receptionist", view.Landing);
        Assert.Equal(["RECEPTIONIST", "CASHIER"], view.Roles.Select(r => r.Code));
        Assert.Equal(view.Permissions.Order(StringComparer.Ordinal), view.Permissions);
        Assert.Contains("PAYMENT_COLLECT", view.Permissions);
    }

    [Fact]
    public void RolePermissions_CopiedFromJava()
    {
        Assert.Equal(6, RolePermissions.ForRole(Role.ADMIN).Count);
        Assert.Equal(23, RolePermissions.ForRole(Role.DISPATCHER).Count);
        Assert.Equal(39, Enum.GetValues<Permission>().Length);
        Assert.Equal([Permission.QUOTE_DECIDE_OWN, Permission.PORTAL_SELF], RolePermissions.ForRole(Role.CUSTOMER).Order());
    }

    [Fact]
    public void RefreshTokenHash_IsSha256Hex()
    {
        Assert.Equal("03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4", AuthService.Hash("1234"));
    }

    [Fact]
    public void PortalGrant_ParsesScopeClaim()
    {
        var grant = PortalGrant.FromClaim("ticket:TN-2026-0925-00421")!;
        Assert.True(grant.AllowsTicket("TN-2026-0925-00421"));
        Assert.False(grant.AllowsRequest("TN-2026-0925-00421"));
        Assert.Equal("request:YC-1", new PortalGrant(PortalScope.REQUEST, "YC-1").Claim());
        Assert.Null(PortalGrant.FromClaim("other:1"));
    }

    [Fact]
    public async Task Jwt_AccessTokenCarriesJavaClaims()
    {
        var options = Options.Create(new SecurityOptions());
        var keys = new JwtKeys(options, new Environment("Development"));
        var account = Account.Employee("letan", "{bcrypt}x", [Role.RECEPTIONIST, Role.CASHIER], "NV-004", false);
        var token = new JwtService(keys, options, TimeProvider.System).IssueAccessToken(account, "Lễ tân");
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, new TokenValidationParameters
        {
            ValidIssuer = "longmanloc-service-center",
            ValidateAudience = false,
            IssuerSigningKey = keys.Verifying,
        });
        Assert.True(result.IsValid, result.Exception?.Message);
        var jwt = (JsonWebToken)result.SecurityToken;
        Assert.Equal("access", jwt.GetClaim("typ").Value);
        Assert.Equal("NV-004", jwt.GetClaim("employeeId").Value);
        Assert.Equal("1", jwt.GetClaim("ver").Value);
        Assert.Equal(["CASHIER", "RECEPTIONIST"], jwt.Claims.Where(c => c.Type == "roles").Select(c => c.Value));
    }

    [Fact]
    public void Jwt_ProductionRequiresKeys() =>
        Assert.Throws<InvalidOperationException>(() => new JwtKeys(Options.Create(new SecurityOptions()), new Environment("Production")));

    [Fact]
    public void RateLimiter_DeniesAfterLimitWithinWindow()
    {
        var limiter = new RateLimiter(new MemoryCache(new MemoryCacheOptions()), TimeProvider.System);
        for (var attempt = 0; attempt < 5; attempt++) limiter.Acquire("portal-lookup-ip:1.2.3.4", 5, TimeSpan.FromMinutes(1));
        Assert.Equal(ErrorCode.RATE_LIMITED, Assert.Throws<DomainException>(() => limiter.Acquire("portal-lookup-ip:1.2.3.4", 5, TimeSpan.FromMinutes(1))).Code);
    }

    private sealed class Environment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "Soopi.Api";

        public string ContentRootPath { get; set; } = "";

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
