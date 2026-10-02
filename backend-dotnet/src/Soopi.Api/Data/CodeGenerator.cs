using System.Globalization;

namespace Soopi.Api.Data;

public enum CodeScope
{
    Daily,
    Yearly,
    Global,
}

public sealed record BusinessCodeType(string Prefix, CodeScope Scope, int SequenceWidth)
{
    public static readonly BusinessCodeType Ticket = new("TN", CodeScope.Daily, 5);
    public static readonly BusinessCodeType WarrantyRequest = new("YC", CodeScope.Daily, 5);
    public static readonly BusinessCodeType Quotation = new("BG", CodeScope.Daily, 5);
    public static readonly BusinessCodeType StockIssue = new("PX", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType StockReceipt = new("PN", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType StockTransfer = new("DC", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType Payment = new("PT", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType Handover = new("PBG", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType Assignment = new("PC", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType Inspection = new("PKT", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType RepairOrder = new("PSC", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType RepairResult = new("KQ", CodeScope.Yearly, 5);
    public static readonly BusinessCodeType Customer = new("KH", CodeScope.Global, 6);
    public static readonly BusinessCodeType Employee = new("NV", CodeScope.Global, 3);
    public static readonly BusinessCodeType Device = new("TB", CodeScope.Global, 6);
    public static readonly BusinessCodeType Product = new("SP", CodeScope.Global, 4);
    public static readonly BusinessCodeType WarrantyPolicy = new("CS", CodeScope.Global, 4);
    public static readonly BusinessCodeType Supplier = new("NCC", CodeScope.Global, 3);
}

/// <summary>
/// Sinh mã nghiệp vụ trên bảng BoDemMa (TN-2026-0917-00421, PX-2026-00001, KH-000001); khóa và định dạng giữ như bản
/// Java nên bộ đếm tiếp tục đúng dãy mã cũ. MERGE … WITH (HOLDLOCK) giữ khóa khoảng tới hết transaction: hai yêu cầu cùng
/// tạo khóa mới xếp hàng thay vì cùng chèn, không có MAX()+1.
/// </summary>
public sealed class CodeGenerator(Sql sql, TimeProvider clock)
{
    public async Task<string> NextAsync(BusinessCodeType type)
    {
        var stem = Stem(type, DbTime.Date(clock.GetUtcNow()));
        var value = await sql.ScalarAsync(
            "MERGE BoDemMa WITH (HOLDLOCK) AS t USING (VALUES (?)) AS n (Khoa) ON t.Khoa = n.Khoa "
            + "WHEN MATCHED THEN UPDATE SET GiaTri = t.GiaTri + 1 "
            + "WHEN NOT MATCHED THEN INSERT (Khoa, GiaTri) VALUES (n.Khoa, 1) OUTPUT inserted.GiaTri;",
            stem) ?? throw new InvalidOperationException("Database không trả về bộ đếm");
        return stem + "-" + Convert.ToInt64(value, CultureInfo.InvariantCulture).ToString(new string('0', type.SequenceWidth), CultureInfo.InvariantCulture);
    }

    public static string Stem(BusinessCodeType type, DateOnly date) => type.Scope switch
    {
        CodeScope.Daily => $"{type.Prefix}-{date:yyyy}-{date:MMdd}",
        CodeScope.Yearly => $"{type.Prefix}-{date:yyyy}",
        _ => type.Prefix,
    };
}
