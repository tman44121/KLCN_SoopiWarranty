using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Json;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Shared;

namespace Soopi.Tests;

public class ProtectionSettingsTests
{
    [Fact]
    public void DefaultsMatchPreviousHardCodedValues()
    {
        var p = new ProtectionSettings().Validated();
        Assert.Equal((5, 15), (p.LoginMaxFailedAttempts, p.LoginLockMinutes));
        Assert.Equal((5, 60, 5), (p.OtpValidityMinutes, p.OtpResendSeconds, p.OtpMaxFailedAttempts));
        Assert.Equal((15, 12, 30, 30), (p.AccessTokenMinutes, p.RefreshTokenHours, p.RememberTokenDays, p.PortalTokenMinutes));
        Assert.Equal(new RateLimitSetting(10, 1), p.LoginIp);
        Assert.Equal(new RateLimitSetting(5, 1), p.LoginAccount);
        Assert.Equal(new RateLimitSetting(20, 60), p.OtpIp);
        Assert.Equal(new RateLimitSetting(5, 60), p.OtpEmail);
        Assert.Equal(new RateLimitSetting(3, 60), p.PublicRequestsIp);
    }

    [Fact]
    public void Validated_RejectsOutOfRangeAndInvertedSessionLifetimes()
    {
        Assert.Throws<DomainException>(() => (new ProtectionSettings() with { OtpValidityMinutes = 31 }).Validated());
        Assert.Throws<DomainException>(() => (new ProtectionSettings() with { LoginIp = new RateLimitSetting(0, 1) }).Validated());
        Assert.Throws<DomainException>(() => (new ProtectionSettings() with { LookupCode = null! }).Validated());
        // Hạn phiên truy cập 13 giờ > hạn đăng nhập thường 12 giờ.
        Assert.Throws<DomainException>(() => (new ProtectionSettings() with { AccessTokenMinutes = 780 }).Validated());
    }

    [Theory]
    [InlineData("{not json")]
    [InlineData("{\"loginIp\":null}")]
    [InlineData("{\"otpValidityMinutes\":999}")]
    [InlineData(null)]
    public async Task BrokenOrMissingStoredJson_FallsBackToDefaults_InsteadOfBlockingLogin(string? json)
    {
        var settings = await TestTimeSettings.CreateRaw(json).GetAsync();
        Assert.Equal(new ProtectionSettings(), settings.Protection);
    }

    [Fact]
    public async Task StoredValues_AreAppliedByRateLimiter()
    {
        var stored = new ProtectionSettings { LoginAccount = new RateLimitSetting(2, 5), OtpValidityMinutes = 10 };
        var protection = (await TestTimeSettings.Create(stored).GetAsync()).Protection;
        Assert.Equal(10, protection.OtpValidityMinutes);

        var limiter = new RateLimiter(new MemoryCache(new MemoryCacheOptions()), TimeProvider.System);
        limiter.CheckLogin("ip", "admin", protection);
        limiter.CheckLogin("ip", "admin", protection);
        var error = Assert.Throws<DomainException>(() => limiter.CheckLogin("ip", "admin", protection));
        Assert.Equal(ErrorCode.RATE_LIMITED, error.Code);
    }

    [Fact]
    public void PublicBody_HidesProtection_AdminBodyIncludesIt()
    {
        var json = JsonSerializer.Serialize(TimeSettingsBody.From(TimeSettings.Default), JsonSetup.Create());
        Assert.DoesNotContain("protection", json);
        Assert.NotNull(TimeSettingsBody.From(TimeSettings.Default, admin: true).Protection);
    }
}
