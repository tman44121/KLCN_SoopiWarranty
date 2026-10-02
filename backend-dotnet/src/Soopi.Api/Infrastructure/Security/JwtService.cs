using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Identity;

namespace Soopi.Api.Infrastructure.Security;

/// <summary>
/// Cặp khóa RSA ký JWT. Có cấu hình đường dẫn PEM thì đọc file (dùng lại khóa của bản Java thì token cũ vẫn hợp lệ); môi
/// trường Production bắt buộc có khóa; ngoài Production tự sinh khóa tạm (token mất hiệu lực khi khởi động lại).
/// </summary>
public sealed class JwtKeys
{
    public JwtKeys(IOptions<SecurityOptions> options, IHostEnvironment environment)
    {
        var jwt = options.Value.Jwt;
        RSA rsa;
        if (!string.IsNullOrWhiteSpace(jwt.PrivateKeyLocation) && !string.IsNullOrWhiteSpace(jwt.PublicKeyLocation))
        {
            rsa = RSA.Create();
            rsa.ImportFromPem(File.ReadAllText(Path(jwt.PrivateKeyLocation)));
            var publicKey = RSA.Create();
            publicKey.ImportFromPem(File.ReadAllText(Path(jwt.PublicKeyLocation)));
            Verifying = new RsaSecurityKey(publicKey);
        }
        else if (environment.IsProduction())
        {
            throw new InvalidOperationException("Môi trường Production bắt buộc cấu hình khóa JWT RSA (Security:Jwt:PrivateKeyLocation/PublicKeyLocation)");
        }
        else
        {
            rsa = RSA.Create(2048);
            Verifying = new RsaSecurityKey(rsa.ExportParameters(false));
        }
        Signing = new SigningCredentials(new RsaSecurityKey(rsa), SecurityAlgorithms.RsaSha256);
    }

    public SigningCredentials Signing { get; }

    public SecurityKey Verifying { get; }

    private static string Path(string location) =>
        location.StartsWith("file:", StringComparison.OrdinalIgnoreCase) ? location["file:".Length..] : location;
}

/// <summary>Phát access token (typ=access) và portal token (typ=portal, một phạm vi, không refresh) — claim như bản Java.</summary>
public sealed class JwtService(JwtKeys keys, IOptions<SecurityOptions> options, TimeProvider clock)
{
    private readonly JsonWebTokenHandler handler = new();

    public string IssueAccessToken(Account account, string displayName)
    {
        var claims = new Dictionary<string, object>
        {
            ["sub"] = account.Id.ToString(),
            ["jti"] = Guid.NewGuid().ToString(),
            ["username"] = account.Username,
            ["roles"] = account.Roles.Select(role => role.ToString()).Order(StringComparer.Ordinal).ToArray(),
            ["principalType"] = account.PrincipalType.ToString(),
            ["displayName"] = displayName,
            ["ver"] = account.SecurityVersion,
            ["typ"] = "access",
        };
        if (account.EmployeeId is not null) claims["employeeId"] = account.EmployeeId;
        if (account.CustomerId is not null) claims["customerId"] = account.CustomerId;
        return Issue(claims, options.Value.Jwt.AccessTokenTtl);
    }

    public (string Token, TimeSpan ExpiresIn) IssuePortalToken(PortalGrant grant)
    {
        var ttl = options.Value.Jwt.PortalTokenTtl;
        var claims = new Dictionary<string, object>
        {
            ["sub"] = "portal:" + grant.Code,
            ["jti"] = Guid.NewGuid().ToString(),
            ["typ"] = "portal",
            ["scope"] = grant.Claim(),
        };
        return (Issue(claims, ttl), ttl);
    }

    private string Issue(Dictionary<string, object> claims, TimeSpan ttl)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        return handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = options.Value.Jwt.Issuer,
            IssuedAt = now,
            NotBefore = now,
            Expires = now + ttl,
            Claims = claims,
            SigningCredentials = keys.Signing,
        });
    }
}
