using System.Globalization;
using System.Xml.Linq;

namespace Soopi.Api.Services.Reporting;

public static partial class ReportWorkbook
{
    private static readonly XNamespace Ch = "http://schemas.openxmlformats.org/drawingml/2006/chart";
    private static readonly XNamespace A = "http://schemas.openxmlformats.org/drawingml/2006/main";
    private static readonly XNamespace D = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
    private const string Forest = "244C43", Honey = "EFB952", Navy = "29354A";
    private sealed record Chart(string Title, int CategoryColumn, int[] ValueColumns, string Kind = "col", string? HighlightCategory = null);

    private static bool HasChartData(Sheet sheet, object?[][] rows) => sheet.Chart is {} chart &&
        rows.Any(row => chart.ValueColumns.Any(column => row[column] is long or int or decimal &&
            (chart.Kind != "doughnut" || Convert.ToDecimal(row[column], CultureInfo.InvariantCulture) > 0)));

    private static XElement ChartDrawing(Sheet sheet, int rowCount)
    {
        // Wide technician tables keep their chart below the data; other charts sit beside their table.
        var below = sheet.Headers.Length > 4;
        return new XElement(D + "wsDr", new XAttribute(XNamespace.Xmlns + "xdr", D), new XAttribute(XNamespace.Xmlns + "a", A),
            new XElement(D + "oneCellAnchor",
                new XElement(D + "from", new XElement(D + "col", below ? 0 : sheet.Headers.Length + 1),
                    new XElement(D + "colOff", 0), new XElement(D + "row", below ? rowCount + 3 : 1), new XElement(D + "rowOff", 0)),
                new XElement(D + "ext", new XAttribute("cx", 6858000), new XAttribute("cy", 4572000)),
                ChartFrame(sheet.Chart!.Title, 1, "rId1"),
                new XElement(D + "clientData")));
    }

    private static XElement ChartFrame(string title, int id, string relationship) => new(D + "graphicFrame", new XAttribute("macro", ""),
        new XElement(D + "nvGraphicFramePr", new XElement(D + "cNvPr", new XAttribute("id", id),
            new XAttribute("name", title)), new XElement(D + "cNvGraphicFramePr")),
        new XElement(D + "xfrm", new XElement(A + "off", new XAttribute("x", 0), new XAttribute("y", 0)),
            new XElement(A + "ext", new XAttribute("cx", 0), new XAttribute("cy", 0))),
        new XElement(A + "graphic", new XElement(A + "graphicData", new XAttribute("uri", Ch.NamespaceName),
            new XElement(Ch + "chart", new XAttribute(XNamespace.Xmlns + "r", R), new XAttribute(R + "id", relationship)))));

    private static XElement ChartDocument(Sheet sheet, object?[][] rows, int skip = 0, string? title = null, bool compact = false)
    {
        var chart = sheet.Chart!;
        var doughnut = chart.Kind == "doughnut";
        var plot = new XElement(Ch + (doughnut ? "doughnutChart" : "barChart"),
            doughnut ? null : new[] { Value("barDir", chart.Kind), Value("grouping", "clustered") },
            Value("varyColors", doughnut ? 1 : 0),
            chart.ValueColumns.Select((column, index) => Series(sheet, rows, column, index, skip)),
            DataLabels(sheet, rows.Length, compact),
            doughnut ? new[] {
                Value("firstSliceAng", 270), Value("holeSize", 65),
            } : new[] { Value("gapWidth", 90), Value("overlap", 0), Value("axId", 10), Value("axId", 20) });
        return new XElement(Ch + "chartSpace", new XAttribute(XNamespace.Xmlns + "c", Ch), new XAttribute(XNamespace.Xmlns + "a", A),
            Value("lang", "vi-VN"), Value("roundedCorners", 1),
            new XElement(Ch + "chart", ChartTitle(title ?? chart.Title, compact ? 1200 : 1400), Value("autoTitleDeleted", 0),
                new XElement(Ch + "plotArea", new XElement(Ch + "layout"), plot,
                    doughnut ? null : new[] { CategoryAxis(chart.Kind, compact), NumberAxis(sheet, compact) }),
                doughnut || chart.ValueColumns.Length > 1
                    ? new XElement(Ch + "legend", Value("legendPos", "b"), new XElement(Ch + "layout"), Value("overlay", 0),
                        ChartText(size: compact ? 900 : 1100)) : null,
                Value("plotVisOnly", 1), Value("dispBlanksAs", "gap"), Value("showDLblsOverMax", 0)),
            new XElement(Ch + "spPr", new XElement(A + "solidFill", new XElement(A + "srgbClr", new XAttribute("val", "FFFFFF"))),
                new XElement(A + "ln", new XElement(A + "solidFill", new XElement(A + "srgbClr", new XAttribute("val", "D9E3DB"))))),
            ChartText());
    }

    private static XElement DataLabels(Sheet sheet, int count, bool compact)
    {
        var doughnut = sheet.Chart!.Kind == "doughnut";
        return new XElement(Ch + "dLbls",
            doughnut ? Enumerable.Range(0, count).Select(i => new XElement(Ch + "dLbl", Value("idx", i),
                ChartText(i % 2 == 0 ? "FFFFFF" : Navy, 1200),
                Value("showLegendKey", 0), Value("showVal", 0), Value("showCatName", 0),
                Value("showSerName", 0), Value("showPercent", 1))) : null,
            doughnut ? null : new XElement(Ch + "numFmt", new XAttribute("formatCode", ChartNumberFormat(sheet)),
                new XAttribute("sourceLinked", 0)), ChartText(size: compact ? 900 : 1100),
            // Excel uses the automatic center position for doughnut labels; an explicit position can trigger repair.
            doughnut ? null : Value("dLblPos", "outEnd"), Value("showLegendKey", 0),
            Value("showVal", doughnut ? 0 : 1), Value("showCatName", 0), Value("showSerName", 0),
            Value("showPercent", doughnut ? 1 : 0));
    }

    private static string ChartNumberFormat(Sheet sheet) => sheet.MoneyColumn >= 0 ? "0.0,," :
        sheet.Name == "Thời gian xử lý" ? "0.0" : "#,##0";

    private static XElement Series(Sheet sheet, object?[][] rows, int column, int index, int skip)
    {
        var chart = sheet.Chart!;
        var colors = new[] { Forest, Honey };
        var categoryCache = new XElement(Ch + "strCache", Value("ptCount", rows.Length),
            rows.Select((row, i) => new XElement(Ch + "pt", new XAttribute("idx", i),
                new XElement(Ch + "v", SafeText(row[chart.CategoryColumn])))));
        // Missing measurements stay missing in both the cells and the chart cache.
        var numberCache = new XElement(Ch + "numCache", new XElement(Ch + "formatCode", ChartNumberFormat(sheet)), Value("ptCount", rows.Length),
            rows.Select((row, i) => row[column] is long or int or decimal
                ? new XElement(Ch + "pt", new XAttribute("idx", i), new XElement(Ch + "v", Convert.ToString(row[column], CultureInfo.InvariantCulture))) : null));
        return new XElement(Ch + "ser", Value("idx", index), Value("order", index),
            new XElement(Ch + "tx", chart.ValueColumns.Length > 1
                ? new XElement(Ch + "v", index == 0 ? "Được giao" : "Hoàn tất")
                : new XElement(Ch + "strRef", new XElement(Ch + "f", Reference(sheet, column, 1, 1)),
                new XElement(Ch + "strCache", Value("ptCount", 1), new XElement(Ch + "pt", new XAttribute("idx", 0),
                    new XElement(Ch + "v", sheet.Headers[column]))))),
            chart.Kind == "doughnut"
                ? rows.Select((_, i) => new XElement(Ch + "dPt", Value("idx", i), SeriesColor(colors[i % colors.Length])))
                : new[] { SeriesColor(chart.ValueColumns.Length > 1 && index == 0 ? Honey : Forest) },
            chart.HighlightCategory is not null ? rows.Select((row, i) => SafeText(row[chart.CategoryColumn]) == chart.HighlightCategory
                ? new XElement(Ch + "dPt", Value("idx", i), SeriesColor(Honey)) : null) : null,
            new XElement(Ch + "cat", new XElement(Ch + "strRef", new XElement(Ch + "f", Reference(sheet, chart.CategoryColumn, skip + 2, skip + rows.Length + 1)), categoryCache)),
            new XElement(Ch + "val", new XElement(Ch + "numRef", new XElement(Ch + "f", Reference(sheet, column, skip + 2, skip + rows.Length + 1)), numberCache)));
    }

    private static string Reference(Sheet sheet, int column, int first, int last)
    {
        var cell = "$" + (char)('A' + column);
        return $"'{sheet.Name.Replace("'", "''")}'!{cell}${first}" + (first == last ? "" : $":{cell}${last}");
    }

    private static XElement SeriesColor(string color) => new(Ch + "spPr", new XElement(A + "solidFill",
        new XElement(A + "srgbClr", new XAttribute("val", color))), new XElement(A + "ln", new XElement(A + "noFill")));

    private static XElement ChartTitle(string text, int size = 1100) => new(Ch + "title", new XElement(Ch + "tx", new XElement(Ch + "rich",
        new XElement(A + "bodyPr"), new XElement(A + "lstStyle"), new XElement(A + "p",
            new XElement(A + "pPr", new XElement(A + "defRPr", new XAttribute("sz", size), new XAttribute("b", 1),
                new XElement(A + "solidFill", new XElement(A + "srgbClr", new XAttribute("val", Navy))),
                new XElement(A + "latin", new XAttribute("typeface", "Arial")))),
            new XElement(A + "r", new XElement(A + "rPr", new XAttribute("lang", "vi-VN")), new XElement(A + "t", text))))),
        new XElement(Ch + "layout"), Value("overlay", 0));

    private static XElement CategoryAxis(string kind, bool compact) => new(Ch + "catAx", Value("axId", 10),
        new XElement(Ch + "scaling", Value("orientation", kind == "bar" ? "maxMin" : "minMax")), Value("delete", 0), Value("axPos", kind == "bar" ? "l" : "b"),
        Value("majorTickMark", "none"), Value("minorTickMark", "none"), Value("tickLblPos", "nextTo"),
        ChartText(size: compact ? 900 : 1100), Value("crossAx", 20), Value("crosses", "autoZero"),
        Value("auto", 1), Value("lblAlgn", "ctr"), Value("lblOffset", 100));

    private static XElement NumberAxis(Sheet sheet, bool compact) => new(Ch + "valAx", Value("axId", 20),
        new XElement(Ch + "scaling", Value("orientation", "minMax"), Value("min", 0)), Value("delete", 0),
        Value("axPos", sheet.Chart!.Kind == "bar" ? "b" : "l"), new XElement(Ch + "majorGridlines",
                new XElement(Ch + "spPr", new XElement(A + "ln", new XElement(A + "solidFill", new XElement(A + "srgbClr", new XAttribute("val", "EAEFE9")))))),
        ChartTitle(sheet.MoneyColumn >= 0 ? "Triệu đồng" : sheet.Name == "Thời gian xử lý" ? "Giờ" :
            sheet.Chart.ValueColumns.Length > 1 ? "Số lệnh sửa" : "Số phiếu", 900),
        new XElement(Ch + "numFmt", new XAttribute("formatCode", ChartNumberFormat(sheet)), new XAttribute("sourceLinked", 0)),
        Value("majorTickMark", "none"), Value("minorTickMark", "none"), Value("tickLblPos", "nextTo"),
        ChartText(size: compact ? 900 : 1100), Value("crossAx", 10),
        Value("crosses", sheet.Chart.Kind == "bar" ? "max" : "autoZero"), Value("crossBetween", "between"));

    private static XElement ChartText(string color = Navy, int size = 1100) => new(Ch + "txPr", new XElement(A + "bodyPr"), new XElement(A + "lstStyle"),
        new XElement(A + "p", new XElement(A + "pPr", new XElement(A + "defRPr", new XAttribute("sz", size),
            new XElement(A + "solidFill", new XElement(A + "srgbClr", new XAttribute("val", color))),
            new XElement(A + "latin", new XAttribute("typeface", "Arial")))), new XElement(A + "endParaRPr", new XAttribute("lang", "vi-VN"))));

    private static XElement Value(string name, object value) => new(Ch + name, new XAttribute("val", value));
}
