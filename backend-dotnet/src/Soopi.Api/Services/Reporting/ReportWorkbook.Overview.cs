using Soopi.Api.Data;
using System.Globalization;
using System.Xml.Linq;

namespace Soopi.Api.Services.Reporting;

public static partial class ReportWorkbook
{
    private sealed record OverviewChart(int SheetIndex, int Left, int Top, int Right, int Bottom,
        string Title, int Skip = 0, int Take = int.MaxValue)
    {
        public int ChartId => 10 + SheetIndex;
        public object?[][] Rows(object?[][][] rows) => rows[SheetIndex].Skip(Skip).Take(Take).ToArray();
    }

    private static OverviewChart[] OverviewCharts(object?[][][] rows) => [
        new(1, 0, 11, 18, 26, rows[1].Length > 12 ? "01 · Doanh thu (12 tháng cuối)" : "01 · Doanh thu theo tháng",
            Math.Max(0, rows[1].Length - 12), 12),
        new(5, 19, 11, 30, 26, "02 · Cơ cấu bảo hành"),
        new(2, 0, 27, 9, 42, "03 · Trạng thái phiếu"),
        new(4, 10, 27, 20, 42, rows[4].Length > 5 ? "04 · Hiệu suất kỹ thuật viên (Top 5)" : "04 · Hiệu suất kỹ thuật viên", Take: 5),
        new(3, 21, 27, 30, 42, "05 · Thời gian xử lý"),
    ];

    private static XElement OverviewWorksheet(DateOnly from, DateOnly to, string? station,
        DateTimeOffset generatedAt, ReportSnapshot data, object?[][] metadata, OverviewChart[] layout, OverviewChart[] charts)
    {
        var cells = new SortedDictionary<int, SortedDictionary<int, (object Value, int Style)>>();
        var merges = new List<string>();
        Fill(1, 1, 30, 46, 3);
        Fill(1, 1, 30, 3, 4);
        Merge(1, 1, 19, 3, "soopi  |  BÁO CÁO BẢO HÀNH & SỬA CHỮA", 4);
        Merge(20, 1, 30, 3, $"{from:dd/MM/yyyy} – {to:dd/MM/yyyy}", 1);
        Merge(1, 4, 30, 4, $"{(string.IsNullOrWhiteSpace(station) ? "Tất cả trạm" : station)}  ·  Xuất lúc " +
            generatedAt.ToOffset(DbTime.Offset).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture), 5);

        Kpi(1, 7, "Doanh thu", data.Revenue.Sum(x => x.Total), 7, "Triệu đồng · Theo ngày thu");
        Kpi(9, 15, "Phiếu tiếp nhận", data.Statuses.Sum(x => x.Count), 8, "Phiếu · Theo ngày tiếp nhận");
        Kpi(17, 23, "Thời gian xử lý TB", data.Turnaround.AvgHours, 9, "Giờ · Theo ngày bàn giao");
        Kpi(25, 30, "Trong bảo hành", data.Warranty.FreeRatePercent / 100m, 10, "Theo ngày phân loại / cập nhật");

        foreach (var view in layout)
        {
            Fill(view.Left + 1, view.Top + 1, view.Right, view.Bottom, 14);
            if (charts.Any(chart => chart.SheetIndex == view.SheetIndex)) continue;
            Merge(view.Left + 1, view.Top + 1, view.Right, view.Top + 2, view.Title, 11);
            Merge(view.Left + 1, view.Top + 3, view.Right, view.Bottom, "Chưa có dữ liệu trong kỳ", 13);
        }
        Merge(1, 44, 30, 44, "Nguồn: Dữ liệu báo cáo Soopi tại thời điểm xuất. Xem số liệu đầy đủ ở các sheet chi tiết.", 5);
        Merge(1, 45, 30, 46, "Cột vàng: tháng kết thúc kỳ báo cáo. KTV: vàng = được giao, xanh = hoàn tất. " +
            "Tổng quan hiển thị tối đa 12 tháng cuối và 5 KTV đầu theo xếp hạng báo cáo (điểm đánh giá, số lệnh hoàn tất).", 5);

        Merge(1, 49, 10, 49, "Chỉ tiêu", 15);
        Merge(11, 49, 30, 49, "Giá trị", 15);
        for (var i = 0; i < metadata.Length; i++)
        {
            Merge(1, 50 + i, 10, 50 + i, metadata[i][0]!, 16);
            Merge(11, 50 + i, 30, 50 + i, metadata[i][1] ?? "", 16);
        }
        return new XElement(S + "worksheet", new XAttribute(XNamespace.Xmlns + "r", R),
            new XElement(S + "sheetPr", new XElement(S + "tabColor", new XAttribute("rgb", "FF244C43")),
                new XElement(S + "pageSetUpPr", new XAttribute("fitToPage", 1))),
            new XElement(S + "dimension", new XAttribute("ref", $"A1:AD{49 + metadata.Length}")),
            new XElement(S + "sheetViews", new XElement(S + "sheetView", new XAttribute("workbookViewId", 0),
                new XAttribute("showGridLines", 0), new XAttribute("zoomScale", 65))),
            new XElement(S + "sheetFormatPr", new XAttribute("defaultRowHeight", 15)),
            new XElement(S + "cols", new XElement(S + "col", new XAttribute("min", 1), new XAttribute("max", 30),
                new XAttribute("width", 6.5), new XAttribute("customWidth", 1))),
            new XElement(S + "sheetData", cells.Select(row => new XElement(S + "row", new XAttribute("r", row.Key),
                new XAttribute("ht", row.Key >= 49 ? 30 : row.Key == 6 ? 24 : 15), new XAttribute("customHeight", 1),
                row.Value.Select(cell => Cell(cell.Value.Value, Address(cell.Key, row.Key), cell.Value.Style))))),
            new XElement(S + "mergeCells", new XAttribute("count", merges.Count),
                merges.Select(reference => new XElement(S + "mergeCell", new XAttribute("ref", reference)))),
            new XElement(S + "printOptions", new XAttribute("horizontalCentered", 1)),
            new XElement(S + "pageMargins", new XAttribute("left", .25), new XAttribute("right", .25),
                new XAttribute("top", .3), new XAttribute("bottom", .3), new XAttribute("header", .1), new XAttribute("footer", .1)),
            new XElement(S + "pageSetup", new XAttribute("paperSize", 8), new XAttribute("orientation", "landscape"),
                new XAttribute("fitToWidth", 1), new XAttribute("fitToHeight", 1)),
            charts.Length > 0 ? new XElement(S + "drawing", new XAttribute(R + "id", "rId1")) : null);

        void Fill(int left, int top, int right, int bottom, int style)
        {
            for (var row = top; row <= bottom; row++)
            {
                if (!cells.ContainsKey(row)) cells[row] = [];
                for (var column = left; column <= right; column++) cells[row][column] = ("", style);
            }
        }
        void Merge(int left, int top, int right, int bottom, object value, int style)
        {
            Fill(left, top, right, bottom, style);
            cells[top][left] = (value, style);
            merges.Add($"{Address(left, top)}:{Address(right, bottom)}");
        }
        void Kpi(int left, int right, string label, object? value, int style, string unit)
        {
            Merge(left, 6, right, 6, label, 6);
            Merge(left, 7, right, 9, value ?? "Chưa có dữ liệu", value is null ? 13 : style);
            Merge(left, 10, right, 10, unit, 12);
        }
    }

    private static string Address(int column, int row) =>
        (column > 26 ? "A" + (char)('A' + column - 27) : ((char)('A' + column - 1)).ToString()) + row;

    private static XElement OverviewDrawing(OverviewChart[] charts) => new(D + "wsDr",
        new XAttribute(XNamespace.Xmlns + "xdr", D), new XAttribute(XNamespace.Xmlns + "a", A),
        charts.Select(view => new XElement(D + "twoCellAnchor", new XAttribute("editAs", "absolute"),
            Marker("from", view.Left, view.Top),
            // Extend into the spacer column by 30 px, leaving a gutter close to the 20 px row gap.
            Marker("to", view.Right, view.Bottom, columnOffset: view.Right < 30 ? 30 * 9525 : 0),
            ChartFrame(view.Title, view.ChartId, $"rId{view.ChartId}"), new XElement(D + "clientData"))));

    private static XElement Marker(string name, int column, int row, int columnOffset = 0) => new(D + name,
        new XElement(D + "col", column), new XElement(D + "colOff", columnOffset),
        new XElement(D + "row", row), new XElement(D + "rowOff", 0));
}
