using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Soopi.Api.Data;
using Soopi.Api.Domain.Tickets;

namespace Soopi.Api.Services.Reporting;

public sealed record ReportSnapshot(IReadOnlyList<MonthlyRevenue> Revenue, IReadOnlyList<StatusCount> Statuses,
    Turnaround Turnaround, IReadOnlyList<TechnicianPerformance> Technicians, WarrantyRatio Warranty);

/// <summary>SpreadsheetML snapshot: inline text cannot execute as an Excel formula; numbers remain numeric.</summary>
public static partial class ReportWorkbook
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static readonly XNamespace S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace P = "http://schemas.openxmlformats.org/package/2006/relationships";
    private static readonly XNamespace C = "http://schemas.openxmlformats.org/package/2006/content-types";
    private sealed record Sheet(string Name, string[] Headers, IEnumerable<object?[]> Rows, int MoneyColumn = -1, Chart? Chart = null);

    public static byte[] Create(DateOnly from, DateOnly to, string? station, DateTimeOffset generatedAt, ReportSnapshot data)
    {
        Sheet[] sheets = [
            new("Tổng quan", ["Chỉ tiêu", "Giá trị"], [
                ["Báo cáo", "Soopi — Báo cáo & thống kê"],
                ["Từ ngày", from.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)],
                ["Đến ngày (bao gồm)", to.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)],
                ["Trạm dịch vụ", string.IsNullOrWhiteSpace(station) ? "Tất cả trạm" : station],
                ["Xuất lúc (giờ Việt Nam)", generatedAt.ToOffset(DbTime.Offset).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)],
                ["Doanh thu (VND)", data.Revenue.Sum(x => x.Total)],
                ["Số phiếu thu", data.Revenue.Sum(x => x.Payments)],
                ["Phiếu tiếp nhận", data.Statuses.Sum(x => x.Count)],
                ["Máy đã bàn giao trong kỳ", data.Turnaround.Delivered],
                ["Thời gian xử lý trung bình (giờ)", data.Turnaround.AvgHours],
                ["Thời gian xử lý nhỏ nhất (giờ)", data.Turnaround.MinHours],
                ["Thời gian xử lý lớn nhất (giờ)", data.Turnaround.MaxHours],
                ["Tỷ lệ trong bảo hành (%)", data.Warranty.FreeRatePercent],
                ["Nguồn", "Dữ liệu báo cáo Soopi tại thời điểm xuất; ô trống là chưa có dữ liệu."],
                ["Cách tính kỳ", "Doanh thu: ngày thu; trạng thái và hiệu suất: ngày tiếp nhận; thời gian xử lý: ngày bàn giao; bảo hành: ngày phân loại/cập nhật."],
            ]),
            new("Doanh thu", ["Tháng", "Số phiếu thu", "Doanh thu (VND)"],
                data.Revenue.OrderBy(x => x.Month).Select(x => new object?[] { x.Month, x.Payments, x.Total }), 2,
                new("Doanh thu theo tháng", 0, [2], HighlightCategory: to.ToString("yyyy-MM", CultureInfo.InvariantCulture))),
            new("Trạng thái phiếu", ["Mã trạng thái", "Trạng thái", "Số phiếu"],
                data.Statuses.Select(x => new object?[] { x.Status, Enum.Parse<TicketStatus>(x.Status).SqlLabel(), x.Count }),
                Chart: new("Số phiếu theo trạng thái", 1, [2], "bar")),
            new("Thời gian xử lý", ["Mã nhóm thiết bị", "Số thiết bị đã bàn giao", "Thời gian xử lý trung bình (giờ)"],
                data.Turnaround.ByCategory.Select(x => new object?[] { x.CategoryCode, x.Delivered, x.AvgHours }),
                Chart: new("Thời gian xử lý theo nhóm thiết bị", 0, [2], "bar")),
            new("Hiệu suất kỹ thuật viên", ["Mã nhân viên", "Kỹ thuật viên", "Chuyên môn", "Số lệnh sửa được giao", "Số lệnh sửa hoàn tất", "Số lệnh sửa đã hủy", "Điểm đánh giá trung bình (1–5)", "Tỷ lệ đạt kiểm định lần đầu (%)", "Thời gian sửa trung bình (giờ)"],
                data.Technicians.Select(x => new object?[] { x.EmployeeId, x.FullName, x.Specialty, x.Assigned, x.Completed, x.Cancelled, x.AvgRating, x.FirstPassQcRate, x.AvgRepairHours }),
                Chart: new("Hiệu suất kỹ thuật viên", 1, [3, 4], "bar")),
            new("Tỷ lệ bảo hành", ["Phân loại", "Số phiếu", "Tỷ lệ (%)"], [
                ["Trong bảo hành", data.Warranty.FreeWarranty, data.Warranty.FreeRatePercent],
                ["Ngoài bảo hành (tính phí)", data.Warranty.Charged, data.Warranty.FreeRatePercent is {} rate ? 100m - rate : null],
            ], Chart: new("Cơ cấu bảo hành", 0, [1], "doughnut")),
        ];
        var rows = sheets.Select(sheet => sheet.Rows.ToArray()).ToArray();
        var chartSheets = Enumerable.Range(0, sheets.Length).Where(i => HasChartData(sheets[i], rows[i])).ToArray();
        var overviewLayout = OverviewCharts(rows);
        var overview = overviewLayout.Where(view => HasChartData(sheets[view.SheetIndex],
            view.Rows(rows))).ToArray();
        var chartIds = chartSheets.Select(i => i + 1).Concat(overview.Select(view => view.ChartId));
        var drawingIds = chartSheets.Select(i => i + 1).Concat(overview.Length > 0 ? new[] { 1 } : []);
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            Write(zip, "[Content_Types].xml", new XElement(C + "Types",
                new XElement(C + "Default", new XAttribute("Extension", "rels"), new XAttribute("ContentType", "application/vnd.openxmlformats-package.relationships+xml")),
                new XElement(C + "Default", new XAttribute("Extension", "xml"), new XAttribute("ContentType", "application/xml")),
                Content("/xl/workbook.xml", "sheet.main"), Content("/xl/styles.xml", "styles"),
                sheets.Select((_, i) => Content($"/xl/worksheets/sheet{i + 1}.xml", "worksheet")),
                chartIds.Select(id => new XElement(C + "Override", new XAttribute("PartName", $"/xl/charts/chart{id}.xml"),
                    new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"))),
                drawingIds.Select(id => new XElement(C + "Override", new XAttribute("PartName", $"/xl/drawings/drawing{id}.xml"),
                    new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.drawing+xml")))));
            Write(zip, "_rels/.rels", new XElement(P + "Relationships", Relationship("rId1", "officeDocument", "xl/workbook.xml")));
            Write(zip, "xl/workbook.xml", new XElement(S + "workbook", new XAttribute(XNamespace.Xmlns + "r", R),
                new XElement(S + "sheets", sheets.Select((sheet, i) => new XElement(S + "sheet",
                    new XAttribute("name", sheet.Name), new XAttribute("sheetId", i + 1), new XAttribute(R + "id", $"rId{i + 1}")))),
                new XElement(S + "definedNames", new XElement(S + "definedName", new XAttribute("name", "_xlnm.Print_Area"),
                    new XAttribute("localSheetId", 0), "'Tổng quan'!$A$1:$AD$46"))));
            Write(zip, "xl/_rels/workbook.xml.rels", new XElement(P + "Relationships",
                sheets.Select((_, i) => Relationship($"rId{i + 1}", "worksheet", $"worksheets/sheet{i + 1}.xml")),
                Relationship($"rId{sheets.Length + 1}", "styles", "styles.xml")));
            Write(zip, "xl/styles.xml", Styles());
            if (overview.Length > 0)
            {
                Write(zip, "xl/worksheets/_rels/sheet1.xml.rels", new XElement(P + "Relationships",
                    Relationship("rId1", "drawing", "../drawings/drawing1.xml")));
                Write(zip, "xl/drawings/drawing1.xml", OverviewDrawing(overview));
                Write(zip, "xl/drawings/_rels/drawing1.xml.rels", new XElement(P + "Relationships",
                    overview.Select(view => Relationship($"rId{view.ChartId}", "chart", $"../charts/chart{view.ChartId}.xml"))));
                foreach (var view in overview)
                    Write(zip, $"xl/charts/chart{view.ChartId}.xml", ChartDocument(sheets[view.SheetIndex],
                        view.Rows(rows), view.Skip, view.Title, compact: true));
            }
            for (var i = 0; i < sheets.Length; i++)
            {
                var hasChart = chartSheets.Contains(i);
                Write(zip, $"xl/worksheets/sheet{i + 1}.xml", i == 0
                    ? OverviewWorksheet(from, to, station, generatedAt, data, rows[0], overviewLayout, overview)
                    : Worksheet(sheets[i], rows[i], hasChart));
                if (!hasChart) continue;
                var id = i + 1;
                Write(zip, $"xl/worksheets/_rels/sheet{id}.xml.rels", new XElement(P + "Relationships",
                    Relationship("rId1", "drawing", $"../drawings/drawing{id}.xml")));
                Write(zip, $"xl/drawings/_rels/drawing{id}.xml.rels", new XElement(P + "Relationships",
                    Relationship("rId1", "chart", $"../charts/chart{id}.xml")));
                Write(zip, $"xl/drawings/drawing{id}.xml", ChartDrawing(sheets[i], rows[i].Length));
                Write(zip, $"xl/charts/chart{id}.xml", ChartDocument(sheets[i], rows[i]));
            }
        }
        return output.ToArray();
    }

    public static byte[] CreateAccess(AccessSummary data, IReadOnlyList<AccessLog> logs, AccessFilters? filter = null, string? action = null) => CreateSheets([
        new("Tổng quan truy cập", ["Chỉ tiêu", "Giá trị"], [
            ["Bắt đầu lưu từ", data.TrackingStart.ToString("dd/MM/yyyy")],
            ["Từ ngày", data.From.ToString("dd/MM/yyyy")], ["Đến ngày (bao gồm)", data.To.ToString("dd/MM/yyyy")],
            ["Loại tài khoản", string.IsNullOrEmpty(filter?.Kind) ? "Tất cả" : filter.Kind],
            ["Vai trò", string.IsNullOrEmpty(filter?.Role) ? "Tất cả" : filter.Role],
            ["Tìm kiếm", filter?.Q ?? ""], ["Sự kiện nhật ký", string.IsNullOrEmpty(action) ? "Tất cả" : action],
            ["Tổng lượt tích lũy", data.TotalVisits], ["Lượt trong kỳ", data.Visits], ["Tài khoản trong kỳ", data.Accounts],
            ["Đăng nhập thành công trong kỳ", data.Logins], ["Đăng nhập thất bại trong kỳ", data.Failed],
            ["Online tại thời điểm xuất", data.Online], ["Xuất lúc (giờ Việt Nam)", data.GeneratedAt.ToOffset(DbTime.Offset).ToString("dd/MM/yyyy HH:mm:ss")]
        ]),
        new("Truy cập theo ngày", ["Ngày", "Lượt bắt đầu", "Tài khoản hoạt động", "Đăng nhập thành công", "Đăng nhập thất bại"],
            data.Days.Select(d => new object?[] { d.Day.ToString("dd/MM/yyyy"), d.Visits, d.Accounts, d.Logins, d.Failed })),
        new("Nhật ký đăng nhập", ["Thời gian (giờ Việt Nam)", "Tài khoản", "Họ tên", "Loại", "Vai trò", "Sự kiện"],
            logs.Select(l => new object?[] { l.At?.ToOffset(DbTime.Offset).ToString("dd/MM/yyyy HH:mm:ss"), l.Username, l.FullName, l.Kind, l.Roles, l.Label }))
    ]);

    private static byte[] CreateSheets(Sheet[] sheets)
    {
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            Write(zip, "[Content_Types].xml", new XElement(C + "Types",
                new XElement(C + "Default", new XAttribute("Extension", "rels"), new XAttribute("ContentType", "application/vnd.openxmlformats-package.relationships+xml")),
                new XElement(C + "Default", new XAttribute("Extension", "xml"), new XAttribute("ContentType", "application/xml")),
                Content("/xl/workbook.xml", "sheet.main"), Content("/xl/styles.xml", "styles"),
                sheets.Select((_, i) => Content($"/xl/worksheets/sheet{i + 1}.xml", "worksheet"))));
            Write(zip, "_rels/.rels", new XElement(P + "Relationships", Relationship("rId1", "officeDocument", "xl/workbook.xml")));
            Write(zip, "xl/workbook.xml", new XElement(S + "workbook", new XAttribute(XNamespace.Xmlns + "r", R),
                new XElement(S + "sheets", sheets.Select((sheet, i) => new XElement(S + "sheet",
                    new XAttribute("name", sheet.Name), new XAttribute("sheetId", i + 1), new XAttribute(R + "id", $"rId{i + 1}"))))));
            Write(zip, "xl/_rels/workbook.xml.rels", new XElement(P + "Relationships",
                sheets.Select((_, i) => Relationship($"rId{i + 1}", "worksheet", $"worksheets/sheet{i + 1}.xml")),
                Relationship($"rId{sheets.Length + 1}", "styles", "styles.xml")));
            Write(zip, "xl/styles.xml", Styles());
            for (var i = 0; i < sheets.Length; i++)
                Write(zip, $"xl/worksheets/sheet{i + 1}.xml", Worksheet(sheets[i], sheets[i].Rows.ToArray(), hasChart: false));
        }
        return output.ToArray();
    }

    private static XElement Content(string path, string type) => new(C + "Override", new XAttribute("PartName", path),
        new XAttribute("ContentType", $"application/vnd.openxmlformats-officedocument.spreadsheetml.{type}+xml"));

    private static XElement Relationship(string id, string type, string target) => new(P + "Relationship",
        new XAttribute("Id", id), new XAttribute("Type", R.NamespaceName + "/" + type), new XAttribute("Target", target));

    private static void Write(ZipArchive zip, string path, XElement root)
    {
        using var stream = zip.CreateEntry(path, CompressionLevel.Fastest).Open();
        new XDocument(new XDeclaration("1.0", "utf-8", "yes"), root).Save(stream);
    }

    private static XElement Worksheet(Sheet sheet, object?[][] data, bool hasChart)
    {
        var rows = new[] { sheet.Headers.Cast<object?>().ToArray() }.Concat(data).ToArray();
        return new XElement(S + "worksheet",
            new XAttribute(XNamespace.Xmlns + "r", R),
            new XElement(S + "sheetPr", new XElement(S + "tabColor", new XAttribute("rgb", "FF244C43"))),
            new XElement(S + "sheetViews", new XElement(S + "sheetView", new XAttribute("workbookViewId", 0),
                new XAttribute("showGridLines", 0),
                new XElement(S + "pane", new XAttribute("ySplit", 1), new XAttribute("topLeftCell", "A2"),
                    new XAttribute("activePane", "bottomLeft"), new XAttribute("state", "frozen")))),
            new XElement(S + "cols", sheet.Headers.Select((_, i) => new XElement(S + "col",
                new XAttribute("min", i + 1), new XAttribute("max", i + 1),
                new XAttribute("width", sheet.Name == "Tổng quan" ? (i == 0 ? 38 : 95) : i == 1 ? 36 : 26), new XAttribute("customWidth", 1)))),
            new XElement(S + "sheetData", rows.Select((row, r) => new XElement(S + "row", new XAttribute("r", r + 1),
                r == 0 ? new XAttribute("ht", 36) : null, r == 0 ? new XAttribute("customHeight", 1) : null,
                row.Select((value, c) => Cell(value, $"{(char)('A' + c)}{r + 1}", r == 0 ? 15 : c == sheet.MoneyColumn ? 2 : 16))))),
            new XElement(S + "autoFilter", new XAttribute("ref", $"A1:{(char)('A' + sheet.Headers.Length - 1)}{rows.Length}")),
            hasChart ? new XElement(S + "drawing", new XAttribute(R + "id", "rId1")) : null);
    }

    private static XElement Cell(object? value, string reference, int style)
    {
        var cell = new XElement(S + "c", new XAttribute("r", reference), new XAttribute("s", style));
        if (value is null) return cell;
        if (value is long or int or decimal)
            cell.Add(new XElement(S + "v", Convert.ToString(value, CultureInfo.InvariantCulture)));
        else
        {
            // XML 1.0 excludes control characters, while valid Unicode (including emoji) is preserved.
            var text = SafeText(value);
            cell.Add(new XAttribute("t", "inlineStr"), new XElement(S + "is", new XElement(S + "t",
                new XAttribute(XNamespace.Xml + "space", "preserve"), text)));
        }
        return cell;
    }

    private static string SafeText(object? value) => string.Concat((value?.ToString() ?? "").EnumerateRunes()
        .Where(r => r.Value is 9 or 10 or 13 or >= 32 and not 65534 and not 65535));

    private static XElement Styles() => new(S + "styleSheet",
        new XElement(S + "numFmts", new XAttribute("count", 3),
            NumberFormat(164, "#,##0.00 \"đ\""), NumberFormat(165, "0.0,,\" triệu ₫\""), NumberFormat(166, "0.0\" giờ\"")),
        new XElement(S + "fonts", new XAttribute("count", 8),
            Font(11, "29354A"), Font(11, "FFFFFF", true), Font(18, "FFFFFF", true), Font(12, "FFFFFF", true),
            Font(25, "29354A", true), Font(9, "62716C"), Font(12, "29354A", true), Font(12, "62716C")),
        new XElement(S + "fills", new XAttribute("count", 6),
            new XElement(S + "fill", new XElement(S + "patternFill", new XAttribute("patternType", "none"))),
            new XElement(S + "fill", new XElement(S + "patternFill", new XAttribute("patternType", "gray125"))),
            FillColor("244C43"), FillColor("F8F7F2"), FillColor("FFFFFF"), FillColor("DDEFE4")),
        new XElement(S + "borders", new XAttribute("count", 2), new XElement(S + "border"),
            new XElement(S + "border", new[] { "left", "right", "top", "bottom" }.Select(side =>
                new XElement(S + side, new XAttribute("style", "thin"),
                    new XElement(S + "color", new XAttribute("rgb", "FFB9D5C3")))))),
        new XElement(S + "cellStyleXfs", new XAttribute("count", 1), Format(0, 0, 0)),
        new XElement(S + "cellXfs", new XAttribute("count", 17),
            Format(0, 0, 0), Format(1, 2, 0), Format(0, 0, 164, border: 1),
            Format(0, 3, 0), Format(2, 2, 0), Format(5, 3, 0), Format(3, 2, 0),
            Format(4, 4, 165), Format(4, 4, 3), Format(4, 4, 166), Format(4, 4, 9),
            Format(6, 4, 0), Format(5, 4, 0), Format(7, 4, 0), Format(0, 4, 0),
            Format(1, 2, 0, border: 1), Format(0, 4, 0, border: 1)),
        new XElement(S + "cellStyles", new XAttribute("count", 1), new XElement(S + "cellStyle", new XAttribute("name", "Normal"), new XAttribute("xfId", 0), new XAttribute("builtinId", 0))));

    private static XElement NumberFormat(int id, string code) => new(S + "numFmt",
        new XAttribute("numFmtId", id), new XAttribute("formatCode", code));

    private static XElement FillColor(string color) => new(S + "fill", new XElement(S + "patternFill",
        new XAttribute("patternType", "solid"), new XElement(S + "fgColor", new XAttribute("rgb", "FF" + color)),
        new XElement(S + "bgColor", new XAttribute("indexed", 64))));

    private static XElement Font(int size, string color, bool bold = false) => new(S + "font", bold ? new XElement(S + "b") : null,
        new XElement(S + "sz", new XAttribute("val", size)), new XElement(S + "color", new XAttribute("rgb", "FF" + color)),
        new XElement(S + "name", new XAttribute("val", "Arial")));

    private static XElement Format(int font, int fill, int number, int border = 0) => new(S + "xf", new XAttribute("fontId", font),
        new XAttribute("fillId", fill), new XAttribute("borderId", border), new XAttribute("numFmtId", number),
        new XAttribute("xfId", 0), new XAttribute("applyAlignment", 1), new XAttribute("applyBorder", 1),
        new XElement(S + "alignment", new XAttribute("horizontal", "left"), new XAttribute("vertical", "center"),
            new XAttribute("wrapText", 1), new XAttribute("indent", 1)));
}
