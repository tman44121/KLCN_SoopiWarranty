using Microsoft.Extensions.Options;
using Soopi.Api.Services.Billing;

namespace Soopi.Tests;

public class VietQrTests
{
    private static VietQr With(string bank = "MB", string account = "0961575900", string name = "", string template = "compact2") =>
        new(Options.Create(new VietQrOptions { BankId = bank, AccountNo = account, AccountName = name, Template = template }));

    [Fact]
    public void Build_PutsAmountAndTicketCodeIntoQuickLink()
    {
        var qr = With().Build("TN-2026-0917-00421", 1_890_000m)!;
        Assert.Equal("SOOPI TN2026091700421", qr.TransferNote);
        Assert.True(qr.TransferNote.Length <= 25);
        Assert.Equal("https://img.vietqr.io/image/MB-0961575900-compact2.png?amount=1890000&addInfo=SOOPI%20TN2026091700421", qr.ImageUrl);
        Assert.Equal(1_890_000m, qr.Amount);
        Assert.Null(qr.AccountName);
    }

    [Fact]
    public void Build_EscapesAccountName()
    {
        var qr = With(name: "NGUYEN VAN A & B").Build("TN-1", 50_000m)!;
        Assert.EndsWith("&accountName=NGUYEN%20VAN%20A%20%26%20B", qr.ImageUrl);
    }

    [Fact]
    public void Build_ReturnsNullWhenAccountNotConfigured()
    {
        Assert.Null(With(bank: "").Build("TN-1", 1m));
        Assert.Null(With(account: " ").Build("TN-1", 1m));
    }
}
