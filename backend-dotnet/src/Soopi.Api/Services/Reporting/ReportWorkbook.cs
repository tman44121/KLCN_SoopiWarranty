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
public static class ReportWorkbook
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static readonly XNamespace S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace P = "http://schemas.openxmlformats.org/package/2006/relationships";
    private static readonly XNamespace C = "http://schemas.openxmlformats.org/package/2006/content-types";
    private sealed record Sheet(string Name, string[] Headers, IEnumerable<object?[]> Rows, int MoneyColumn = -1);

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
                ["Thời gian xử lý TB (giờ)", data.Turnaround.AvgHours],
                ["Thời gian xử lý nhỏ nhất (giờ)", data.Turnaround.MinHours],
                ["Thời gian xử lý lớn nhất (giờ)", data.Turnaround.MaxHours],
                ["Tỷ lệ trong bảo hành (%)", data.Warranty.FreeRatePercent],
                ["Nguồn", "Dữ liệu báo cáo Soopi tại thời điểm xuất; ô trống là chưa có dữ liệu."],
                ["Cách tính kỳ", "Doanh thu: ngày thu; trạng thái và hiệu suất: ngày tiếp nhận; thời gian xử lý: ngày bàn giao; bảo hành: ngày phân loại/cập nhật."],
            ]),
            new("Doanh thu", ["Tháng", "Số phiếu thu", "Doanh thu (VND)"],
                data.Revenue.OrderBy(x => x.Month).Select(x => new object?[] { x.Month, x.Payments, x.Total }), 2),
            new("Trạng thái phiếu", ["Mã trạng thái", "Trạng thái", "Số phiếu"],
                data.Statuses.Select(x => new object?[] { x.Status, Enum.Parse<TicketStatus>(x.Status).SqlLabel(), x.Count })),
            new("Thời gian xử lý", ["Mã nhóm thiết bị", "Máy đã bàn giao", "Thời gian xử lý TB (giờ)"],
                data.Turnaround.ByCategory.Select(x => new object?[] { x.CategoryCode, x.Delivered, x.AvgHours })),
            new("Hiệu suất KTV", ["Mã nhân viên", "Kỹ thuật viên", "Chuyên môn", "Được giao", "Hoàn tất", "Đã hủy lệnh sửa", "Điểm TB (1–5)", "QC đạt lần đầu (%)", "Thời gian sửa TB (giờ)"],
                data.Technicians.Select(x => new object?[] { x.EmployeeId, x.FullName, x.Specialty, x.Assigned, x.Completed, x.Cancelled, x.AvgRating, x.FirstPassQcRate, x.AvgRepairHours })),
            new("Tỷ lệ bảo hành", ["Phân loại", "Số phiếu", "Tỷ lệ (%)"], [
                ["Trong bảo hành", data.Warranty.FreeWarranty, data.Warranty.FreeRatePercent],
                ["Ngoài bảo hành (tính phí)", data.Warranty.Charged, data.Warranty.FreeRatePercent is {} rate ? 100m - rate : null],
            ]),
        ];
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
            for (var i = 0; i < sheets.Length; i++) Write(zip, $"xl/worksheets/sheet{i + 1}.xml", Worksheet(sheets[i]));
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

    private static XElement Worksheet(Sheet sheet)
    {
        var rows = new[] { sheet.Headers.Cast<object?>().ToArray() }.Concat(sheet.Rows).ToArray();
        return new XElement(S + "worksheet",
            new XElement(S + "sheetViews", new XElement(S + "sheetView", new XAttribute("workbookViewId", 0),
                new XElement(S + "pane", new XAttribute("ySplit", 1), new XAttribute("topLeftCell", "A2"),
                    new XAttribute("activePane", "bottomLeft"), new XAttribute("state", "frozen")))),
            new XElement(S + "cols", sheet.Headers.Select((_, i) => new XElement(S + "col",
                new XAttribute("min", i + 1), new XAttribute("max", i + 1),
                new XAttribute("width", sheet.Name == "Tổng quan" ? (i == 0 ? 38 : 95) : i == 1 ? 36 : 26), new XAttribute("customWidth", 1)))),
            new XElement(S + "sheetData", rows.Select((row, r) => new XElement(S + "row", new XAttribute("r", r + 1),
                row.Select((value, c) => Cell(value, $"{(char)('A' + c)}{r + 1}", r == 0 ? 1 : c == sheet.MoneyColumn ? 2 : 0))))),
            new XElement(S + "autoFilter", new XAttribute("ref", $"A1:{(char)('A' + sheet.Headers.Length - 1)}{rows.Length}")));
    }

    private static XElement? Cell(object? value, string reference, int style)
    {
        if (value is null) return null;
        var cell = new XElement(S + "c", new XAttribute("r", reference), new XAttribute("s", style));
        if (value is long or int or decimal)
            cell.Add(new XElement(S + "v", Convert.ToString(value, CultureInfo.InvariantCulture)));
        else
        {
            // XML 1.0 excludes control characters, while valid Unicode (including emoji) is preserved.
            var text = string.Concat(value.ToString()!.EnumerateRunes().Where(r => r.Value is 9 or 10 or 13 or >= 32 and not 65534 and not 65535));
            cell.Add(new XAttribute("t", "inlineStr"), new XElement(S + "is", new XElement(S + "t",
                new XAttribute(XNamespace.Xml + "space", "preserve"), text)));
        }
        return cell;
    }

    private static XElement Styles() => new(S + "styleSheet",
        new XElement(S + "numFmts", new XAttribute("count", 1), new XElement(S + "numFmt", new XAttribute("numFmtId", 164), new XAttribute("formatCode", "#,##0.00 \"đ\""))),
        new XElement(S + "fonts", new XAttribute("count", 2), Font(false), Font(true)),
        new XElement(S + "fills", new XAttribute("count", 3),
            new XElement(S + "fill", new XElement(S + "patternFill", new XAttribute("patternType", "none"))),
            new XElement(S + "fill", new XElement(S + "patternFill", new XAttribute("patternType", "gray125"))),
            new XElement(S + "fill", new XElement(S + "patternFill", new XAttribute("patternType", "solid"),
                new XElement(S + "fgColor", new XAttribute("rgb", "FF244C43")), new XElement(S + "bgColor", new XAttribute("indexed", 64))))),
        new XElement(S + "borders", new XAttribute("count", 1), new XElement(S + "border")),
        new XElement(S + "cellStyleXfs", new XAttribute("count", 1), Format(0, 0, 0)),
        new XElement(S + "cellXfs", new XAttribute("count", 3), Format(0, 0, 0), Format(1, 2, 0), Format(0, 0, 164)),
        new XElement(S + "cellStyles", new XAttribute("count", 1), new XElement(S + "cellStyle", new XAttribute("name", "Normal"), new XAttribute("xfId", 0), new XAttribute("builtinId", 0))));

    private static XElement Font(bool header) => new(S + "font", header ? new XElement(S + "b") : null,
        new XElement(S + "sz", new XAttribute("val", 11)), new XElement(S + "name", new XAttribute("val", "Arial")),
        new XElement(S + "color", new XAttribute("rgb", header ? "FFFFFFFF" : "FF29354A")));

    private static XElement Format(int font, int fill, int number) => new(S + "xf", new XAttribute("fontId", font),
        new XAttribute("fillId", fill), new XAttribute("borderId", 0), new XAttribute("numFmtId", number),
        new XAttribute("xfId", 0), new XAttribute("applyAlignment", 1),
        new XElement(S + "alignment", new XAttribute("vertical", "top"), new XAttribute("wrapText", 1)));
}
