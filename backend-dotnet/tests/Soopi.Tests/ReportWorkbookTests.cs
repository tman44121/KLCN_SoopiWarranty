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
    private static readonly XNamespace Chart = "http://schemas.openxmlformats.org/drawingml/2006/chart";
    private static readonly XNamespace Drawing = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
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
        Assert.Equal(["Tổng quan", "Doanh thu", "Trạng thái phiếu", "Thời gian xử lý", "Hiệu suất kỹ thuật viên", "Tỷ lệ bảo hành"],
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
        var missingRating = performance.Descendants(S + "c").Single(x => (string?)x.Attribute("r") == "G2");
        Assert.Empty(missingRating.Elements());
        Assert.NotNull(performance.Root!.Element(S + "autoFilter"));
    }

    [Fact]
    public void Workbook_EmptyReportStillOpensWithHeadersAndNoInventedMeasurements()
    {
        using var zip = Open(new([], [], new(0, null, null, null, []), [], new(0, 0, null)));
        for (var i = 1; i <= 6; i++) Assert.NotNull(Read(zip, $"xl/worksheets/sheet{i}.xml").Root);
        Assert.Single(Read(zip, "xl/worksheets/sheet2.xml").Descendants(S + "row"));
        Assert.Single(Read(zip, "xl/worksheets/sheet5.xml").Descendants(S + "row"));
        Assert.DoesNotContain(zip.Entries, entry => entry.FullName.StartsWith("xl/charts/"));
        Assert.DoesNotContain(zip.Entries, entry => entry.FullName.StartsWith("xl/drawings/"));
    }

    [Fact]
    public void Workbook_ChartsAreLinkedToDataWithVietnameseTitlesAndNumericCaches()
    {
        using var zip = Open(Sample);
        string[] titles = ["Doanh thu theo tháng", "Số phiếu theo trạng thái", "Thời gian xử lý theo nhóm thiết bị",
            "Hiệu suất kỹ thuật viên", "Cơ cấu bảo hành"];
        for (var i = 2; i <= 6; i++)
        {
            Assert.Single(Read(zip, $"xl/worksheets/sheet{i}.xml").Descendants(S + "drawing"));
            Assert.NotNull(zip.GetEntry($"xl/worksheets/_rels/sheet{i}.xml.rels"));
            Assert.NotNull(zip.GetEntry($"xl/drawings/_rels/drawing{i}.xml.rels"));
            var chart = Read(zip, $"xl/charts/chart{i}.xml");
            Assert.Contains(titles[i - 2], chart.ToString());
            var sheetName = Read(zip, "xl/workbook.xml").Descendants(S + "sheet").ElementAt(i - 1).Attribute("name")!.Value;
            Assert.All(chart.Descendants(Chart + "f"), formula => Assert.StartsWith($"'{sheetName}'!$", formula.Value));
            Assert.NotEmpty(chart.Descendants(Chart + "numCache").Descendants(Chart + "pt"));
            if (i != 6)
            {
                Assert.Equal("0", (string?)chart.Descendants(Chart + "catAx").Single().Element(Chart + "delete")?.Attribute("val"));
                Assert.Equal("0", (string?)chart.Descendants(Chart + "valAx").Single().Element(Chart + "delete")?.Attribute("val"));
            }
        }
        var revenue = Read(zip, "xl/charts/chart2.xml");
        Assert.Contains(revenue.Descendants(Chart + "v"), value => value.Value == "2916000.50");
        var performance = Read(zip, "xl/charts/chart5.xml");
        Assert.Equal(2, performance.Descendants(Chart + "ser").Count());
        Assert.Contains(performance.Descendants(Chart + "v"), value => value.Value == Sample.Technicians[0].FullName);
        Assert.NotNull(Read(zip, "xl/charts/chart6.xml").Descendants(Chart + "doughnutChart").SingleOrDefault());
        var anchor = Read(zip, "xl/drawings/drawing5.xml").Descendants(Drawing + "from").Single();
        Assert.True(int.Parse(anchor.Element(Drawing + "row")!.Value) > Sample.Technicians.Count);
    }

    [Fact]
    public void Workbook_DoesNotChartUnknownDurationsAsZero()
    {
        using var zip = Open(Sample with { Turnaround = new(1, null, null, null, [new("PHONE", 1, null)]) });
        Assert.Null(zip.GetEntry("xl/charts/chart4.xml"));
        Assert.Empty(Read(zip, "xl/worksheets/sheet4.xml").Descendants(S + "drawing"));
    }

    [Fact]
    public void Workbook_DurationChartKeepsMissingMeasurementsAtTheirOriginalCategoryIndices()
    {
        using var zip = Open(Sample with { Turnaround = new(2, 12.5m, null, null,
            [new("PHONE", 1, null), new("LAPTOP", 1, 12.5m)]) });
        var cache = Read(zip, "xl/charts/chart4.xml").Descendants(Chart + "numCache").Single();
        Assert.Equal("2", (string?)cache.Element(Chart + "ptCount")!.Attribute("val"));
        var point = Assert.Single(cache.Elements(Chart + "pt"));
        Assert.Equal("1", (string?)point.Attribute("idx"));
        Assert.Equal("12.5", point.Element(Chart + "v")!.Value);
    }

    [Fact]
    public void Workbook_OverviewShowsRealKpisAndFiveEditableChartsInTheApprovedLayout()
    {
        using var zip = Open(Sample);
        var overview = Read(zip, "xl/worksheets/sheet1.xml");
        Assert.Equal("0", (string?)overview.Descendants(S + "sheetView").Single().Attribute("showGridLines"));
        Assert.Contains(overview.Descendants(S + "t"), text => text.Value.Contains("BÁO CÁO BẢO HÀNH & SỬA CHỮA"));
        Assert.Equal(2916000.50m, Number("A7"));
        Assert.Equal(3m, Number("I7"));
        Assert.Equal(12.5m, Number("Q7"));
        Assert.Equal(.333m, Number("Y7"));
        Assert.Contains(overview.Descendants(S + "mergeCell"), x => (string?)x.Attribute("ref") == "A7:G9");
        Assert.Equal("landscape", (string?)overview.Descendants(S + "pageSetup").Single().Attribute("orientation"));
        var drawing = Read(zip, "xl/drawings/drawing1.xml");
        Assert.Equal(5, drawing.Descendants(Drawing + "graphicFrame").Count());
        Assert.Equal(5, Read(zip, "xl/drawings/_rels/drawing1.xml.rels").Root!.Elements().Count());
        foreach (var id in Enumerable.Range(11, 5))
        {
            var chart = Read(zip, $"xl/charts/chart{id}.xml");
            Assert.NotEmpty(chart.Descendants(Chart + "numCache").Descendants(Chart + "pt"));
            Assert.All(chart.Descendants(Chart + "f"), x => Assert.DoesNotContain("Tổng quan", x.Value));
        }

        decimal Number(string cell) => decimal.Parse(overview.Descendants(S + "c")
            .Single(x => (string?)x.Attribute("r") == cell).Element(S + "v")!.Value,
            System.Globalization.CultureInfo.InvariantCulture);
    }

    [Fact]
    public void Workbook_OverviewDoesNotInventMissingKpisOrEmptyCharts()
    {
        using var zip = Open(new([], [], new(0, null, null, null, []), [], new(0, 0, null)));
        var overview = Read(zip, "xl/worksheets/sheet1.xml");
        Assert.Empty(overview.Descendants(S + "drawing"));
        foreach (var reference in new[] { "Q7", "Y7" })
        {
            var cell = overview.Descendants(S + "c").Single(x => (string?)x.Attribute("r") == reference);
            Assert.Null(cell.Element(S + "v"));
            Assert.Contains("Chưa có dữ liệu", cell.Value);
        }
        Assert.Equal(5, overview.Descendants(S + "t").Count(x => x.Value == "Chưa có dữ liệu trong kỳ"));
    }

    [Fact]
    public void Workbook_OverviewBoundsLongReportsWithoutLosingDetailRowsOrChartReferences()
    {
        var months = Enumerable.Range(0, 18).Select(i => new MonthlyRevenue(
            From.AddMonths(i).ToString("yyyy-MM"), i + 1, (i + 1) * 1000000m)).ToArray();
        var technicians = Enumerable.Range(0, 12).Select(i => Sample.Technicians[0] with {
            EmployeeId = $"NV-{i:000}", FullName = $"Kỹ thuật viên {i}" }).ToArray();
        using var zip = Open(Sample with { Revenue = months, Technicians = technicians });
        var revenue = Read(zip, "xl/charts/chart11.xml");
        Assert.Equal("12", (string?)revenue.Descendants(Chart + "numCache").Single().Element(Chart + "ptCount")!.Attribute("val"));
        Assert.Contains("'Doanh thu'!$C$8:$C$19", revenue.ToString());
        var performance = Read(zip, "xl/charts/chart14.xml");
        Assert.All(performance.Descendants(Chart + "numCache"), x =>
            Assert.Equal("5", (string?)x.Element(Chart + "ptCount")!.Attribute("val")));
        Assert.Equal(19, Read(zip, "xl/worksheets/sheet2.xml").Descendants(S + "row").Count());
        Assert.Equal(13, Read(zip, "xl/worksheets/sheet5.xml").Descendants(S + "row").Count());
    }

    [Fact]
    public void Workbook_ChartsUseBrandColorsAndExcelCompatibleDoughnutLabels()
    {
        using var zip = Open(Sample);
        XNamespace art = "http://schemas.openxmlformats.org/drawingml/2006/main";
        var revenue = Read(zip, "xl/charts/chart2.xml");
        var highlighted = Assert.Single(revenue.Descendants(Chart + "dPt"));
        Assert.Equal("EFB952", (string?)highlighted.Descendants(art + "srgbClr").Single().Attribute("val"));
        var performance = Read(zip, "xl/charts/chart5.xml").Descendants(Chart + "ser").ToArray();
        Assert.Equal("EFB952", (string?)performance[0].Element(Chart + "spPr")!.Descendants(art + "srgbClr").Single().Attribute("val"));
        Assert.Equal("244C43", (string?)performance[1].Element(Chart + "spPr")!.Descendants(art + "srgbClr").Single().Attribute("val"));
        foreach (var id in new[] { 6, 15 })
        {
            var chart = Read(zip, $"xl/charts/chart{id}.xml");
            Assert.Empty(chart.Descendants(Chart + "dLblPos"));
            Assert.All(chart.Descendants(Chart + "showPercent"), flag => Assert.Equal("1", (string?)flag.Attribute("val")));
            Assert.All(chart.Descendants(Chart + "showCatName"), flag => Assert.Equal("0", (string?)flag.Attribute("val")));
        }
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
