using System.IO.Compression;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Infrastructure.Security;
using Soopi.Api.Services.Reporting;

namespace Soopi.Tests;

public class ReportWorkbookTests
{
    private static readonly XNamespace S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly DateOnly From = new(2026, 10, 1);
    private static readonly DateOnly To = new(2026, 10, 20);
    private static readonly DateTimeOffset At = new(2026, 10, 20, 4, 0, 0, TimeSpan.Zero);
    private static readonly ReportSnapshot Sample = new(
        [new("2026-10", 2, 2916000.50m)], [new("DELIVERED", 3)],
        new(3, 12.5m, 2, 20, [new("PHONE", 3, 12.5m)]),
        [new("NV-001", "=HYPERLINK(\"https://example.invalid\") & <Tên>", null, 4, 3, 1, null, 66.7m, 8.25m)],
        new(1, 2, 33.3m));

    [Fact]
    public void Workbook_HasSixLinkedSheetsAndFilterMetadata()
    {
        using var zip = Open(Sample);
        var workbook = Read(zip, "xl/workbook.xml");
        Assert.Equal(["Tổng quan", "Doanh thu", "Trạng thái phiếu", "Thời gian xử lý", "Hiệu suất KTV", "Tỷ lệ bảo hành"],
            workbook.Descendants(S + "sheet").Select(x => (string?)x.Attribute("name")));
        Assert.NotNull(zip.GetEntry("[Content_Types].xml"));
        Assert.NotNull(zip.GetEntry("_rels/.rels"));
        Assert.Equal(7, Read(zip, "xl/_rels/workbook.xml.rels").Root!.Elements().Count());
        var summary = Read(zip, "xl/worksheets/sheet1.xml");
        Assert.Contains("01/10/2026", summary.ToString());
        Assert.Contains("20/10/2026", summary.ToString());
        Assert.Contains("ST01", summary.ToString());
        Assert.Contains("20/10/2026 11:00", summary.ToString());
    }

    [Fact]
    public void Workbook_KeepsNumbersNumericNullsBlankAndUntrustedNamesAsText()
    {
        using var zip = Open(Sample);
        var revenue = Read(zip, "xl/worksheets/sheet2.xml");
        var total = revenue.Descendants(S + "c").Single(x => (string?)x.Attribute("r") == "C2");
        Assert.Equal("2916000.50", total.Element(S + "v")!.Value);
        Assert.Null(total.Attribute("t"));
        var performance = Read(zip, "xl/worksheets/sheet5.xml");
        var name = performance.Descendants(S + "c").Single(x => (string?)x.Attribute("r") == "B2");
        Assert.Equal("inlineStr", (string?)name.Attribute("t"));
        Assert.Equal(Sample.Technicians[0].FullName, name.Element(S + "is")!.Element(S + "t")!.Value);
        Assert.Empty(performance.Descendants(S + "f"));
        Assert.DoesNotContain(performance.Descendants(S + "c"), x => (string?)x.Attribute("r") == "G2");
        Assert.NotNull(performance.Root!.Element(S + "autoFilter"));
    }

    [Fact]
    public void Workbook_EmptyReportStillOpensWithHeadersAndNoInventedMeasurements()
    {
        using var zip = Open(new([], [], new(0, null, null, null, []), [], new(0, 0, null)));
        for (var i = 1; i <= 6; i++) Assert.NotNull(Read(zip, $"xl/worksheets/sheet{i}.xml").Root);
        Assert.Single(Read(zip, "xl/worksheets/sheet2.xml").Descendants(S + "row"));
        Assert.Single(Read(zip, "xl/worksheets/sheet5.xml").Descendants(S + "row"));
    }

    [Theory]
    [InlineData(Role.CUSTOMER)]
    [InlineData(Role.DISPATCHER)]
    [InlineData(Role.RECEPTIONIST)]
    [InlineData(Role.CASHIER)]
    [InlineData(Role.WAREHOUSE_KEEPER)]
    public async Task Export_RejectsMissingReportPermissionsBeforeDatabaseAccess(Role role)
    {
        var service = Service(role);
        var error = await Assert.ThrowsAsync<DomainException>(() => service.ExportAsync(From, To, null));
        Assert.Equal(ErrorCode.ACCESS_DENIED, error.Code);
    }

    [Fact]
    public async Task Export_RejectsReversedAndOverflowingDatesBeforeDatabaseAccess()
    {
        var service = Service(Role.ADMIN);
        foreach (var dates in new[] { (To, From), (From, DateOnly.MaxValue) })
        {
            var error = await Assert.ThrowsAsync<DomainException>(() => service.ExportAsync(dates.Item1, dates.Item2, null));
            Assert.Equal(ErrorCode.VALIDATION_FAILED, error.Code);
        }
    }

    private static ReportService Service(Role role)
    {
        var context = new DefaultHttpContext();
        context.Items["soopi.actor"] = new AuthenticatedActor(1, "test", new HashSet<Role> { role }, RolePermissions.ForRole(role), null, null, null);
        return new(null!, new CurrentActor(new HttpContextAccessor { HttpContext = context }), TimeProvider.System, new ConfigurationBuilder().Build());
    }

    private static ZipArchive Open(ReportSnapshot data) =>
        new(new MemoryStream(ReportWorkbook.Create(From, To, "ST01", At, data)), ZipArchiveMode.Read);

    private static XDocument Read(ZipArchive zip, string path)
    {
        using var stream = zip.GetEntry(path)!.Open();
        return XDocument.Load(stream);
    }
}
