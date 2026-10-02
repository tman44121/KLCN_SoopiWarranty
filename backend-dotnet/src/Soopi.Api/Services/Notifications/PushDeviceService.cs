using System.Text.RegularExpressions;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Notifications;

/// <summary>Đăng ký / gỡ thiết bị nhận push. Chỉ tài khoản đăng nhập, không nhận portal token.</summary>
public sealed partial class PushDeviceService(PushDeviceStore devices, CurrentActor actors, TimeProvider clock)
{
    private static readonly HashSet<string> Platforms = ["ANDROID", "IOS"];

    public Task RegisterAsync(string installationId, string? platform, string? pushToken, string? appVersion)
    {
        var actor = actors.RequireSignedIn();
        if (!ValidInstallationId(installationId)
            || platform is null || !Platforms.Contains(platform)
            || string.IsNullOrWhiteSpace(pushToken) || pushToken.Length > 512
            || (appVersion is not null && appVersion.Length > 30))
            throw new DomainException(ErrorCode.VALIDATION_FAILED);
        return devices.UpsertAsync(
            installationId, actor.AccountId!.Value, platform, pushToken.Trim(),
            string.IsNullOrWhiteSpace(appVersion) ? null : appVersion.Trim(), clock.GetUtcNow());
    }

    public Task UnregisterAsync(string installationId) => ForgetAsync(installationId, actors.RequireSignedIn().AccountId!.Value);

    /// <summary>Dùng khi đăng xuất: chỉ gỡ lượt cài nếu nó đang thuộc đúng tài khoản của phiên.</summary>
    public Task ForgetAsync(string? installationId, long accountId) =>
        ValidInstallationId(installationId) ? devices.DeleteAsync(installationId!, accountId) : Task.CompletedTask;

    /// <summary>Dùng khi đặt lại mật khẩu: mọi máy đang đăng nhập đều thôi nhận push của tài khoản.</summary>
    public Task ForgetAllAsync(long accountId) => devices.DeleteAllAsync(accountId);

    private static bool ValidInstallationId(string? value) => value is not null && InstallationId().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9-]{8,64}$")]
    private static partial Regex InstallationId();
}
