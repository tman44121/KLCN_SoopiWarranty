using System.Data.Common;
using System.Globalization;
using System.Text.Json;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data.Stores;

/// <summary>
/// Danh mục quản trị trên các bảng của schema. API danh mục trả/nhận bản ghi dạng map với khóa <c>_id</c> và tên trường
/// tiếng Anh như giao diện đang dùng; lớp này dịch qua lại với cột tiếng Việt.
/// </summary>
public sealed class CatalogStore(Sql sql)
{
    private enum Kind
    {
        Text,
        Number,
        Money,
        Flag,
    }

    private sealed record Field(string Key, string Column, Kind Kind);

    private sealed record Table(string Name, string Key, string SortColumn, Field[] Fields);

    private static Field Text(string key, string column) => new(key, column, Kind.Text);

    private static Field Number(string key, string column) => new(key, column, Kind.Number);

    private static Field Money(string key, string column) => new(key, column, Kind.Money);

    private static Field Flag(string key, string column) => new(key, column, Kind.Flag);

    private static readonly Dictionary<string, Table> Tables = new()
    {
        ["service_stations"] = new("TramDichVu", "MaTram", "TenTram",
            [Text("name", "TenTram"), Text("address", "DiaChi"), Flag("active", "HoatDong")]),
        ["device_categories"] = new("NhomThietBi", "MaNhom", "TenNhom",
            [Text("name", "TenNhom"), Number("sortOrder", "ThuTu"), Flag("active", "HoatDong")]),
        ["brands"] = new("HangSanXuat", "MaHang", "TenHang", [Text("name", "TenHang"), Flag("active", "HoatDong")]),
        ["products"] = new("SanPham", "MaSP", "TenSP",
        [
            Text("name", "TenSP"), Text("brandId", "MaHang"), Text("deviceTypeCode", "MaLoai"), Text("productLine", "DongSanPham"),
            Number("defaultWarrantyMonths", "ThoiHanBaoHanhMacDinhThang"), Flag("active", "HoatDong"),
        ]),
        ["warranty_policies"] = new("ChinhSachBaoHanh", "MaChinhSach", "TenChinhSach",
        [
            Text("scope", "PhamVi"), Text("productId", "MaSP"), Text("brandId", "MaHang"), Text("name", "TenChinhSach"),
            Number("warrantyMonths", "SoThangBaoHanh"), Text("conditions", "DieuKienBaoHanh"),
            Text("rejectionCases", "TruongHopTuChoi"), Text("distributor", "NhaPhanPhoi"), Flag("active", "HoatDong"),
        ]),
        ["service_prices"] = new("BangGiaDichVu", "MaDichVu", "TenDichVu",
            [Text("name", "TenDichVu"), Text("categoryCode", "MaNhom"), Money("price", "DonGia"), Flag("active", "HoatDong")]),
        ["suppliers"] = new("NhaCungCap", "MaNCC", "TenNCC",
        [
            Text("name", "TenNCC"), Text("phone", "SDT"), Text("address", "DiaChi"), Text("email", "Email"), Flag("active", "HoatDong"),
        ]),
        ["parts"] = new("LinhKien", "MaLK", "TenLK",
        [
            Text("name", "TenLK"), Text("unit", "DonViTinh"), Text("categoryCode", "MaNhom"), Text("brandName", "TenHang"),
            Money("costPrice", "DonGiaVon"), Money("servicePrice", "DonGiaDichVu"), Number("minLevel", "DinhMucTonToiThieu"),
            Text("primaryBin", "KeChinh"), Number("warrantyMonths", "ThoiHanBaoHanhThang"), Text("supplierId", "MaNCC"),
            Flag("active", "HoatDong"),
        ]),
    };

    public async Task<List<Dictionary<string, object?>>> ListAsync(string collection)
    {
        var table = TableOf(collection);
        var rows = await sql.QueryAsync($"SELECT * FROM {table.Name} ORDER BY {table.SortColumn}, {table.Key}", row => Read(table, row));
        await EnrichAsync(collection, rows);
        return rows;
    }

    public async Task<Dictionary<string, object?>?> FindAsync(string collection, string id)
    {
        var table = TableOf(collection);
        var rows = await sql.QueryAsync($"SELECT * FROM {table.Name} WHERE {table.Key} = ?", row => Read(table, row), id);
        await EnrichAsync(collection, rows);
        return rows.FirstOrDefault();
    }

    public async Task<Dictionary<string, object?>> SaveAsync(string collection, string id, IReadOnlyDictionary<string, object?> value)
    {
        var table = TableOf(collection);
        var fields = table.Fields.Where(field => value.ContainsKey(field.Key)).ToList();
        var names = string.Join(", ", new[] { table.Key }.Concat(fields.Select(field => field.Column)));
        var updates = fields.Count == 0 ? "" : " WHEN MATCHED THEN UPDATE SET " + string.Join(", ", fields.Select(f => $"{f.Column} = n.{f.Column}"));
        var args = new List<object?> { id };
        args.AddRange(fields.Select(field => ToColumn(field, value[field.Key])));
        await sql.ExecuteAsync(
            $"MERGE {table.Name} WITH (HOLDLOCK) AS t USING (VALUES ({string.Join(", ", args.Select(_ => "?"))})) AS n ({names}) "
            + $"ON t.{table.Key} = n.{table.Key}{updates} WHEN NOT MATCHED THEN INSERT ({names}) VALUES ("
            + string.Join(", ", names.Split(", ").Select(column => "n." + column)) + ");",
            args.ToArray());
        switch (collection)
        {
            case "device_categories":
                await SaveDeviceTypesAsync(id, value.GetValueOrDefault("deviceTypes"));
                break;
            case "brands":
                await SaveBrandCategoriesAsync(id, value.GetValueOrDefault("categoryCodes"));
                break;
            case "parts":
                await EnsurePrimaryBinAsync(id);
                break;
        }
        return await FindAsync(collection, id) ?? throw new DomainException(ErrorCode.NOT_FOUND);
    }

    public async Task<bool> IsReferencedByOpenTicketAsync(string type, string id)
    {
        const string devices = "FROM PhieuTiepNhan ptn JOIN ThietBi tb ON tb.MaThietBi = ptn.MaThietBi "
            + "JOIN SanPham sp ON sp.MaSP = tb.MaSP JOIN LoaiThietBi lt ON lt.MaLoai = sp.MaLoai WHERE ptn.ConMo = 1";
        var query = type switch
        {
            "device-categories" => "SELECT TOP 1 1 " + devices + " AND lt.MaNhom = ?",
            "stations" => "SELECT TOP 1 1 FROM PhieuTiepNhan WHERE ConMo = 1 AND MaTram = ?",
            "products" => "SELECT TOP 1 1 " + devices + " AND sp.MaSP = ?",
            "brands" => "SELECT TOP 1 1 " + devices + " AND sp.MaHang = ?",
            "parts" => "SELECT TOP 1 1 FROM ChiTietBaoGia ct JOIN PhieuBaoGia bg ON bg.MaBaoGia = ct.MaBaoGia "
                + "JOIN PhieuTiepNhan ptn ON ptn.MaPhieuTN = bg.MaPhieuTN WHERE ptn.ConMo = 1 AND ct.MaLK = ?",
            _ => null,
        };
        return query is not null && await sql.ScalarAsync(query, id) is not null;
    }

    /// <summary>Đổi body JSON sang giá trị thường (string, decimal, bool, null, list, map) như Map của Jackson.</summary>
    public static object? Plain(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => element.GetString(),
        JsonValueKind.Number => element.GetDecimal(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Array => element.EnumerateArray().Select(Plain).ToList(),
        JsonValueKind.Object => element.EnumerateObject().ToDictionary(property => property.Name, property => Plain(property.Value)),
        _ => null,
    };

    private static Table TableOf(string collection) => Tables.GetValueOrDefault(collection) ?? throw new DomainException(ErrorCode.NOT_FOUND);

    private static Dictionary<string, object?> Read(Table table, DbDataReader row)
    {
        var result = new Dictionary<string, object?> { ["_id"] = row.Str(table.Key) };
        foreach (var field in table.Fields)
        {
            result[field.Key] = field.Kind switch
            {
                Kind.Text => row.Str(field.Column),
                Kind.Number => row.IntOrNull(field.Column) ?? 0,
                Kind.Money => SqlMoney.Read(row.DecOrNull(field.Column)),
                _ => row.Bool(field.Column),
            };
        }
        return result;
    }

    private static object? ToColumn(Field field, object? value)
    {
        if (value is null) return field.Kind == Kind.Flag ? true : null;
        var text = value switch
        {
            bool flag => flag ? "true" : "false",
            IFormattable number => number.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString() ?? "",
        };
        return field.Kind switch
        {
            Kind.Text => value is string s && string.IsNullOrWhiteSpace(s) ? null : text,
            Kind.Number => decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                && number == decimal.Truncate(number) && number is >= int.MinValue and <= int.MaxValue
                    ? (int)number
                    : throw new DomainException(ErrorCode.VALIDATION_FAILED),
            Kind.Money => decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var money)
                ? money
                : throw new DomainException(ErrorCode.VALIDATION_FAILED),
            _ => value is bool b ? b : string.Equals(text, "true", StringComparison.OrdinalIgnoreCase),
        };
    }

    /// <summary>Dữ liệu con: loại thiết bị của nhóm, nhóm của hãng, nhóm của sản phẩm, tồn kho của linh kiện.</summary>
    private async Task EnrichAsync(string collection, List<Dictionary<string, object?>> rows)
    {
        foreach (var chunk in SqlInList.Chunks(rows))
        {
            var ids = chunk.Select(row => (object?)row["_id"]).ToArray();
            var inList = string.Join(", ", ids.Select(_ => "?"));
            switch (collection)
            {
                case "device_categories":
                {
                    var types = (await sql.QueryAsync(
                        $"SELECT MaNhom, MaLoai, TenLoai, LoaiDinhDanh, ChecklistChanDoan FROM LoaiThietBi WHERE HoatDong = 1 AND MaNhom IN ({inList}) ORDER BY MaNhom, MaLoai",
                        row => (Key: row.Str("MaNhom")!, Value: (object?)new Dictionary<string, object?>
                        {
                            ["code"] = row.Str("MaLoai"),
                            ["name"] = row.Str("TenLoai"),
                            ["identifierType"] = row.Str("LoaiDinhDanh"),
                            ["diagnosticChecklist"] = JsonText.Strings(row.Str("ChecklistChanDoan")),
                        }),
                        ids)).ToLookup(pair => pair.Key, pair => pair.Value);
                    foreach (var row in chunk) row["deviceTypes"] = types[(string)row["_id"]!].ToList();
                    break;
                }
                case "brands":
                {
                    var categories = (await sql.QueryAsync(
                        $"SELECT MaHang, MaNhom FROM HangSanXuat_NhomThietBi WHERE MaHang IN ({inList}) ORDER BY MaNhom",
                        row => (Key: row.Str("MaHang")!, Value: row.Str("MaNhom")),
                        ids)).ToLookup(pair => pair.Key, pair => pair.Value);
                    foreach (var row in chunk) row["categoryCodes"] = categories[(string)row["_id"]!].ToList();
                    break;
                }
                case "products":
                {
                    var categories = (await sql.QueryAsync(
                        $"SELECT sp.MaSP, lt.MaNhom FROM SanPham sp JOIN LoaiThietBi lt ON lt.MaLoai = sp.MaLoai WHERE sp.MaSP IN ({inList})",
                        row => (Key: row.Str("MaSP")!, Value: row.Str("MaNhom")),
                        ids)).ToDictionary(pair => pair.Key, pair => pair.Value);
                    foreach (var row in chunk) row["categoryCode"] = categories.GetValueOrDefault((string)row["_id"]!);
                    break;
                }
                case "parts":
                {
                    var stock = (await sql.QueryAsync(
                        $"SELECT MaLK, SoLuongTon, SoLuongDaGiu FROM LinhKien WHERE MaLK IN ({inList})",
                        row => (Key: row.Str("MaLK")!, OnHand: row.Int("SoLuongTon"), Reserved: row.Int("SoLuongDaGiu")),
                        ids)).ToDictionary(item => item.Key);
                    var bins = (await sql.QueryAsync(
                        $"SELECT MaLK, MaKe, SoLuong FROM TonKhoTheoKe WHERE MaLK IN ({inList}) ORDER BY MaLK, MaKe",
                        row => (Key: row.Str("MaLK")!, Value: new Dictionary<string, object?> { ["binCode"] = row.Str("MaKe"), ["qty"] = row.Int("SoLuong") }),
                        ids)).ToLookup(pair => pair.Key, pair => pair.Value);
                    foreach (var row in chunk)
                    {
                        var id = (string)row["_id"]!;
                        row["onHand"] = stock.TryGetValue(id, out var s) ? s.OnHand : 0;
                        row["reserved"] = stock.TryGetValue(id, out s) ? s.Reserved : 0;
                        row["bins"] = bins[id].ToList();
                    }
                    break;
                }
            }
        }
    }

    private async Task SaveDeviceTypesAsync(string categoryCode, object? value)
    {
        if (value is not List<object?> types) return;
        var kept = new List<string>();
        foreach (var item in types)
        {
            if (item is not Dictionary<string, object?> type || type.GetValueOrDefault("code") is not string code || string.IsNullOrWhiteSpace(code))
                throw new DomainException(ErrorCode.VALIDATION_FAILED);
            kept.Add(code);
            var checklist = type.GetValueOrDefault("diagnosticChecklist") is IEnumerable<object?> list
                ? list.Select(entry => Convert.ToString(entry, CultureInfo.InvariantCulture) ?? "null").ToList()
                : [];
            await sql.ExecuteAsync(
                "MERGE LoaiThietBi WITH (HOLDLOCK) AS t USING (VALUES (?, ?, ?, ?, ?)) AS n (MaLoai, MaNhom, TenLoai, LoaiDinhDanh, ChecklistChanDoan) "
                + "ON t.MaLoai = n.MaLoai WHEN MATCHED THEN UPDATE SET MaNhom = n.MaNhom, TenLoai = n.TenLoai, "
                + "LoaiDinhDanh = n.LoaiDinhDanh, ChecklistChanDoan = n.ChecklistChanDoan, HoatDong = 1 "
                + "WHEN NOT MATCHED THEN INSERT (MaLoai, MaNhom, TenLoai, LoaiDinhDanh, ChecklistChanDoan, HoatDong) "
                + "VALUES (n.MaLoai, n.MaNhom, n.TenLoai, n.LoaiDinhDanh, n.ChecklistChanDoan, 1);",
                code,
                categoryCode,
                type.TryGetValue("name", out var name) ? Convert.ToString(name, CultureInfo.InvariantCulture) ?? "null" : code,
                type.GetValueOrDefault("identifierType") as string == "IMEI" ? "IMEI" : "SERIAL",
                JsonText.Write(checklist));
        }
        var args = new List<object?> { categoryCode };
        args.AddRange(kept);
        await sql.ExecuteAsync(
            "UPDATE LoaiThietBi SET HoatDong = 0 WHERE MaNhom = ?" + (kept.Count == 0 ? "" : $" AND MaLoai NOT IN ({string.Join(", ", kept.Select(_ => "?"))})"),
            args.ToArray());
    }

    private async Task SaveBrandCategoriesAsync(string brandId, object? value)
    {
        if (value is not List<object?> categories) return;
        await sql.ExecuteAsync("DELETE FROM HangSanXuat_NhomThietBi WHERE MaHang = ?", brandId);
        foreach (var category in categories.Select(c => Convert.ToString(c, CultureInfo.InvariantCulture) ?? "null").Distinct())
            await sql.ExecuteAsync("INSERT INTO HangSanXuat_NhomThietBi (MaHang, MaNhom) VALUES (?, ?)", brandId, category);
    }

    /// <summary>Linh kiện mới có ngăn tồn theo kệ chính (0 cái) để các phiếu nhập/xuất sau đó cộng trừ theo kệ.</summary>
    private Task EnsurePrimaryBinAsync(string sku) =>
        sql.ExecuteAsync(
            "INSERT INTO TonKhoTheoKe (MaLK, MaKe, SoLuong) SELECT lk.MaLK, lk.KeChinh, 0 FROM LinhKien lk "
            + "WHERE lk.MaLK = ? AND NOT EXISTS (SELECT 1 FROM TonKhoTheoKe k WITH (UPDLOCK, HOLDLOCK) "
            + "WHERE k.MaLK = lk.MaLK AND k.MaKe = lk.KeChinh)",
            sku);
}
