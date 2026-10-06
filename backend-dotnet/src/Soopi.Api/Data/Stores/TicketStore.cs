using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Domain.Tickets;

namespace Soopi.Api.Data.Stores;

public sealed record TechnicianLoad(long Active, long AtRisk)
{
    public static readonly TechnicianLoad None = new(0, 0);
}

public sealed record TicketFilter(
    string? Status, string? Category, string? Technician, string? Sla, string? Query, DateTimeOffset? From, DateTimeOffset? To,
    DateTimeOffset Now, DateTimeOffset AtRiskUntil);

/// <summary>
/// Aggregate Ticket trên PhieuTiepNhan và các bảng con (như JpaTicketRepository). Mỗi lần lưu:
/// <list type="bullet">
/// <item>dòng phiếu mang trạng thái hiện tại và ConMo; PhienBan luôn tăng và được kiểm (optimistic lock), kể cả khi chỉ thêm
/// ghi chú hay kết quả sửa chữa — lệch phiên bản thì TransactionRunner thử lại;</item>
/// <item>mỗi lần chuyển trạng thái chưa lưu thành một dòng LichSuTrangThai_ThietBi, ghi sau khi dòng phiếu qua kiểm tra
/// phiên bản;</item>
/// <item>bảng con chỉ được thêm/cập nhật phần thay đổi, không xóa lịch sử.</item>
/// </list>
/// </summary>
public sealed class TicketStore(Sql sql)
{
    private const string DefaultTransitionText = "Trạng thái đổi từ";

    // ------------------------------------------------------------------ ghi

    public async Task SaveAsync(Ticket ticket)
    {
        var storedHistory = 0;
        int version;
        if (ticket.Version is null)
        {
            await InsertAsync(ticket);
            version = 0;
        }
        else
        {
            storedHistory = Convert.ToInt32(await sql.ScalarAsync("SELECT COUNT(*) FROM LichSuTrangThai_ThietBi WHERE MaPhieuTN = ?", ticket.Id));
            var status = StatusColumns(ticket);
            var updated = await sql.ExecuteAsync(
                "UPDATE PhieuTiepNhan SET TrangThaiXuLy = ?, ConMo = ?, NgayCapNhatTrangThai = ?, NguoiCapNhatTrangThai = ?, "
                + "VaiTroCapNhatTrangThai = ?, GhiChuTrangThai = ?, PhienBan = PhienBan + 1 WHERE MaPhieuTN = ? AND PhienBan = ?",
                status[0], status[1], status[2], status[3], status[4], status[5], ticket.Id, ticket.Version);
            if (updated != 1) throw new DbUpdateConcurrencyException($"Phiếu {ticket.Id} đã bị thay đổi bởi thao tác khác");
            version = ticket.Version.Value + 1;
        }
        await SaveStatusHistoryAsync(ticket, storedHistory);
        await SaveAssignmentAsync(ticket);
        await SaveInspectionAsync(ticket);
        await SaveRepairOrderAsync(ticket);
        await SaveNotesAsync(ticket, "CUSTOMER", ticket.CustomerNotes);
        await SaveNotesAsync(ticket, "INTERNAL", ticket.InternalNotes);
        await SaveHandoverAsync(ticket);
        ticket.Version = version;
    }

    private Task InsertAsync(Ticket ticket)
    {
        var warranty = ticket.WarrantyAtIntake;
        var cosmetic = ticket.Cosmetic;
        object?[] args =
        [
            ticket.Id, ticket.StationCode, ticket.ReceivedAt, ticket.Channel, ticket.RequestType, ticket.WarrantyRequestId, ticket.CustomerId,
            ticket.DeviceId, ticket.ReceivedBy, warranty.Status, warranty.ActivatedOn, warranty.ExpiresOn, warranty.PolicyId, ticket.SealCondition,
            OrDefault(cosmetic.Scratches, "NONE"), cosmetic.Dents, cosmetic.Cracks, OrDefault(cosmetic.Moisture, "NONE"),
            OrDefault(cosmetic.Accessories, "COMPLETE"), cosmetic.AccessoriesNote, cosmetic.Notes, cosmetic.CustomerAcknowledged,
            ticket.ReportedIssue, ticket.PromisedReturnAt, ticket.EstimatedCost, ticket.Sla.Level, ticket.Sla.DueAt, .. StatusColumns(ticket),
        ];
        return sql.ExecuteAsync(
            "INSERT INTO PhieuTiepNhan (MaPhieuTN, MaTram, NgayTiepNhan, KenhTiepNhan, LoaiYeuCau, MaYeuCau, MaKH, MaThietBi, MaNVTiepNhan, "
            + "BH_TrangThaiLucNhan, BH_NgayKichHoat, BH_NgayHetHan, BH_MaChinhSach, TinhTrangTem, NQ_VetTray, NQ_CanMop, NQ_NutVo, "
            + "NQ_DauHieuAmNuoc, NQ_PhuKien, PhuKienKemTheo, TinhTrangNgoaiQuan, KhachXacNhanNgoaiQuan, MoTaLoiKhachBao, NgayHenTra, "
            + "ChiPhiDuKien, MucSLA, HanSLA, TrangThaiXuLy, ConMo, NgayCapNhatTrangThai, NguoiCapNhatTrangThai, VaiTroCapNhatTrangThai, "
            + "GhiChuTrangThai, PhienBan) VALUES (" + string.Join(", ", args.Select(_ => "?")) + ", 0)",
            args);
    }

    /// <summary>Trạng thái hiện tại và người/thời điểm của lần chuyển gần nhất.</summary>
    private static object?[] StatusColumns(Ticket ticket)
    {
        var entries = ticket.StatusHistory;
        var last = entries[^1];
        return [ticket.Status, ticket.Open, last.At, Limit(last.Actor, 30), Limit(last.ActorRole, 30), entries.Count == 1 ? null : NoteOf(last)];
    }

    private async Task SaveStatusHistoryAsync(Ticket ticket, int from)
    {
        var entries = ticket.StatusHistory;
        for (var index = from; index < entries.Count; index++)
        {
            var entry = entries[index];
            await sql.ExecuteAsync(
                "INSERT INTO LichSuTrangThai_ThietBi (MaPhieuTN, TrangThai, ThoiGianCapNhat, MoTaChiTiet, NguoiCapNhat, TenNguoiCapNhat, "
                + "VaiTroNguoiCapNhat) VALUES (?, ?, ?, ?, ?, ?, ?)",
                ticket.Id, entry.Status, entry.At,
                index == 0 ? Limit(entry.Description, 255) : TransitionText(entries[index - 1].Status, entry),
                Limit(entry.Actor, 100), Limit(entry.ActorName, 100), Limit(entry.ActorRole, 30));
        }
    }

    /// <summary>Cùng dạng dữ liệu cũ: 'Trạng thái đổi từ "A" sang "B"' kèm ghi chú riêng của thao tác (nếu có).</summary>
    private static string TransitionText(TicketStatus previous, StatusHistory entry)
    {
        var text = $"{DefaultTransitionText} \"{previous.SqlLabel()}\" sang \"{entry.Status.SqlLabel()}\"";
        var note = NoteOf(entry);
        return Limit(note is null ? text : text + " " + note, 255)!;
    }

    private static string? NoteOf(StatusHistory entry) =>
        entry.Description is null || entry.Description.StartsWith(DefaultTransitionText, StringComparison.Ordinal) ? null : Limit(entry.Description, 180);

    private async Task SaveAssignmentAsync(Ticket ticket)
    {
        if (ticket.Assignment is not { } assignment) return;
        await sql.ExecuteAsync(
            "MERGE PhanCong WITH (HOLDLOCK) AS t USING (VALUES (?, ?, ?, ?, ?, ?, ?)) AS n (MaPhanCong, MaPhieuTN, MaNVQuanLy, MaKTV, "
            + "NgayPhanCong, MucDoUuTien, GhiChu) ON t.MaPhanCong = n.MaPhanCong WHEN MATCHED THEN UPDATE SET MaNVQuanLy = n.MaNVQuanLy, "
            + "MaKTV = n.MaKTV, NgayPhanCong = n.NgayPhanCong, MucDoUuTien = n.MucDoUuTien, GhiChu = n.GhiChu "
            + "WHEN NOT MATCHED THEN INSERT (MaPhanCong, MaPhieuTN, MaNVQuanLy, MaKTV, NgayPhanCong, MucDoUuTien, GhiChu) "
            + "VALUES (n.MaPhanCong, n.MaPhieuTN, n.MaNVQuanLy, n.MaKTV, n.NgayPhanCong, n.MucDoUuTien, n.GhiChu);",
            assignment.Code, ticket.Id, assignment.ManagerId, assignment.TechnicianId, assignment.AssignedAt, assignment.Priority, Limit(assignment.Note, 255));
        var persisted = Convert.ToInt32(await sql.ScalarAsync("SELECT COUNT(*) FROM LichSuPhanCong WHERE MaPhieuTN = ?", ticket.Id));
        foreach (var change in assignment.History.Skip(persisted))
        {
            await sql.ExecuteAsync(
                "INSERT INTO LichSuPhanCong (MaPhieuTN, MaKTVCu, MaKTVMoi, MaNVThucHien, ThoiGian, GhiChu) VALUES (?, ?, ?, ?, ?, ?)",
                ticket.Id, change.FromTechnicianId, change.TechnicianId, change.ChangedBy, change.ChangedAt, Limit(change.Note, 255));
        }
    }

    private async Task SaveInspectionAsync(Ticket ticket)
    {
        if (ticket.Inspection is not { } inspection) return;
        var existing = await sql.FirstOrDefaultAsync(
            "SELECT NgayKiemTra, NgayCapNhat, SoLanSuaPhanLoai FROM PhieuKiemTra WHERE MaPhieuKT = ?",
            row => (Effective: row.Time("NgayCapNhat") ?? row.Time("NgayKiemTra")!.Value, Revisions: row.Int("SoLanSuaPhanLoai")),
            inspection.Code);
        var checklist = JsonText.Write(inspection.Checklist
            .Select(item => new Dictionary<string, object?> { ["HangMuc"] = item.Item, ["KetQua"] = item.Result, ["GhiChu"] = item.Note }).ToList());
        object?[] fields =
        [
            inspection.TechnicianId, inspection.Findings, checklist, inspection.WaterDamage, inspection.Classification,
            Limit(inspection.OutOfWarrantyReason, 255), inspection.ProposedFix, Limit(inspection.ReclassNote, 500),
        ];
        if (existing.Effective == default)
        {
            await sql.ExecuteAsync(
                "INSERT INTO PhieuKiemTra (MaPhieuKT, MaPhieuTN, NgayKiemTra, MaKTV, KetQuaKiemTraChiTiet, ChecklistKetQua, TinhTrangVaoNuoc, "
                + "PhanLoaiBaoHanh, LyDoNgoaiBaoHanh, HuongKhacPhucDeXuat, GhiChuPhanLoaiLai, SoLanSuaPhanLoai) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
                [inspection.Code, ticket.Id, inspection.InspectedAt, .. fields]);
        }
        else if (DbTime.Local(inspection.InspectedAt) != DbTime.Local(existing.Effective))
        {
            await sql.ExecuteAsync(
                "UPDATE PhieuKiemTra SET MaKTV = ?, KetQuaKiemTraChiTiet = ?, ChecklistKetQua = ?, TinhTrangVaoNuoc = ?, PhanLoaiBaoHanh = ?, "
                + "LyDoNgoaiBaoHanh = ?, HuongKhacPhucDeXuat = ?, GhiChuPhanLoaiLai = ?, SoLanSuaPhanLoai = ?, NgayCapNhat = ? WHERE MaPhieuKT = ?",
                [.. fields, existing.Revisions + 1, inspection.InspectedAt, inspection.Code]);
        }
    }

    private async Task SaveRepairOrderAsync(Ticket ticket)
    {
        if (ticket.RepairOrder is not { } order) return;
        await sql.ExecuteAsync(
            "MERGE PhieuSuaChua WITH (HOLDLOCK) AS t USING (VALUES (?, ?, ?, ?, ?, ?, ?)) AS n (MaPhieuSC, MaPhieuTN, MaPhanCong, MaKTV, NgayTao, "
            + "NgayBatDau, TrangThaiSuaChua) ON t.MaPhieuSC = n.MaPhieuSC WHEN MATCHED THEN UPDATE SET MaPhanCong = n.MaPhanCong, MaKTV = n.MaKTV, "
            + "NgayTao = n.NgayTao, NgayBatDau = n.NgayBatDau, TrangThaiSuaChua = n.TrangThaiSuaChua WHEN NOT MATCHED THEN INSERT (MaPhieuSC, "
            + "MaPhieuTN, MaPhanCong, MaKTV, NgayTao, NgayBatDau, TrangThaiSuaChua) VALUES (n.MaPhieuSC, n.MaPhieuTN, n.MaPhanCong, n.MaKTV, "
            + "n.NgayTao, n.NgayBatDau, n.TrangThaiSuaChua);",
            order.Code, ticket.Id, ticket.Assignment!.Code, order.TechnicianId, order.CreatedAt, order.StartedAt, order.Status);
        var stored = (await sql.QueryAsync("SELECT MaKetQua FROM KetQuaSuaChua WHERE MaPhieuSC = ?", row => row.Str("MaKetQua")!, order.Code)).ToHashSet();
        foreach (var result in order.Results.Where(result => !stored.Contains(result.Code)))
        {
            await sql.ExecuteAsync(
                "INSERT INTO KetQuaSuaChua (MaKetQua, MaPhieuSC, MaKTV, NoiDungSuaChua, KetQuaQCTungBuoc, KetQuaKCS, ChiTietTestKCS, NgayGhiNhan) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                result.Code, order.Code, result.TechnicianId, result.WorkDone,
                JsonText.Write(result.QcSteps.Select(step => new Dictionary<string, object?> { ["Buoc"] = step.Step, ["KetQua"] = step.Result }).ToList()),
                result.QcResult, result.QcDetails, result.RecordedAt);
        }
    }

    private async Task SaveNotesAsync(Ticket ticket, string type, List<Note> values)
    {
        var persisted = Convert.ToInt32(await sql.ScalarAsync("SELECT COUNT(*) FROM GhiChuPhieu WHERE MaPhieuTN = ? AND Loai = ?", ticket.Id, type));
        foreach (var note in values.Skip(persisted))
        {
            await sql.ExecuteAsync(
                "INSERT INTO GhiChuPhieu (MaPhieuTN, Loai, NoiDung, NguoiViet, VaiTroNguoiViet, ThoiGian) VALUES (?, ?, ?, ?, ?, ?)",
                ticket.Id, type, Limit(note.Text, 1000), note.By, Limit(note.Role, 30), note.At);
        }
    }

    private async Task SaveHandoverAsync(Ticket ticket)
    {
        if (ticket.Handover is not { } handover) return;
        var exists = await sql.ScalarAsync("SELECT 1 FROM PhieuBanGiao WHERE MaBanGiao = ?", handover.Code) is not null;
        if (exists)
        {
            await sql.ExecuteAsync("UPDATE PhieuBanGiao SET DanhGiaHaiLong = ? WHERE MaBanGiao = ?", handover.Rating, handover.Code);
            return;
        }
        var recheck = handover.Recheck;
        await sql.ExecuteAsync(
            "INSERT INTO PhieuBanGiao (MaBanGiao, MaPhieuTN, LoaiBanGiao, NgayBanGiao, MaNVBanGiao, NguoiNhanMay, HienTrangKhiTra, TraLaiLinhKienCu, "
            + "ThoiHanBaoHanhMoi, DanhGiaHaiLong, KT_NgoaiQuanDungBienBan, KT_KhoiDongBinhThuong, KT_ChucNangChinhOK, KT_PhuKienDayDu, "
            + "KT_KhongLoiPhatSinh, MaTepChuKy, KhachXacNhanNhanMay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            handover.Code, ticket.Id, ticket.Status == TicketStatus.DELIVERED ? "DELIVERED" : "RETURNED_UNREPAIRED", handover.HandedOverAt,
            handover.HandedOverBy, Limit(handover.ReceiverName, 100), Limit(handover.ConditionOnReturn, 255), handover.ReturnedOldParts,
            Limit(handover.NewWarrantyNote, 100), handover.Rating, recheck?.CosmeticMatches, recheck?.BootsNormally, recheck?.MainFunctionsOk,
            recheck?.AccessoriesComplete, recheck?.NoNewIssues, handover.Signature is null ? null : long.Parse(handover.Signature.FileId),
            handover.CustomerConfirmed);
    }

    // ------------------------------------------------------------------ đọc

    public async Task<Ticket?> FindAsync(string code) => (await LoadAsync([code])).FirstOrDefault();

    public async Task<bool> HasOpenForDeviceAsync(string deviceId) =>
        await sql.ScalarAsync("SELECT TOP 1 1 FROM PhieuTiepNhan WHERE MaThietBi = ? AND ConMo = 1", deviceId) is not null;

    public async Task<List<Ticket>> SearchAsync(TicketFilter filter, int offset, int limit)
    {
        var (where, args) = Where(filter);
        var ids = await sql.QueryAsync(
            $"SELECT ptn.MaPhieuTN {where} ORDER BY ptn.NgayTiepNhan DESC, ptn.MaPhieuTN DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            row => row.Str("MaPhieuTN")!, [.. args, offset, limit]);
        return await LoadAsync(ids);
    }

    public async Task<long> CountAsync(TicketFilter filter)
    {
        var (where, args) = Where(filter);
        return Convert.ToInt64(await sql.ScalarAsync("SELECT COUNT(*) " + where, [.. args]));
    }

    public async Task<List<Ticket>> FindOpenAsync()
    {
        var tickets = await LoadAsync(await IdsAsync("SELECT MaPhieuTN FROM PhieuTiepNhan WHERE ConMo = 1"));
        return tickets
            .OrderBy(ticket => ticket.Assignment?.Priority switch { Priority.URGENT => 0, Priority.NORMAL => 1, _ => 2 })
            .ThenBy(ticket => ticket.PromisedReturnAt is null ? 1 : 0)
            .ThenBy(ticket => ticket.PromisedReturnAt)
            .ToList();
    }

    /// <summary>Phiếu đang xử lý (trừ "Hoàn thành", "Đã hủy") có hạn SLA trong [from, until].</summary>
    public async Task<List<Ticket>> FindSlaDueBetweenAsync(DateTimeOffset from, DateTimeOffset until) =>
        await LoadAsync(await IdsAsync(
            "SELECT MaPhieuTN FROM PhieuTiepNhan WHERE ConMo = 1 AND TrangThaiXuLy NOT IN ('COMPLETED', 'AWAITING_RETURN') AND HanSLA BETWEEN ? AND ?",
            from, until));

    public async Task<List<Ticket>> FindByCustomerAsync(string customerId) =>
        await LoadAsync(await IdsAsync("SELECT MaPhieuTN FROM PhieuTiepNhan WHERE MaKH = ? ORDER BY NgayTiepNhan DESC, MaPhieuTN DESC", customerId));

    /// <summary>Tải của mọi KTV có phiếu mở: số phiếu đang xử lý (trừ "Hoàn thành", "Đã hủy") và số phiếu mở có hạn SLA trong [from, to].</summary>
    public async Task<Dictionary<string, TechnicianLoad>> TechnicianLoadsAsync(DateTimeOffset from, DateTimeOffset to) =>
        (await sql.QueryAsync(
            "SELECT pc.MaKTV, SUM(CASE WHEN ptn.TrangThaiXuLy NOT IN ('COMPLETED', 'AWAITING_RETURN') THEN 1 ELSE 0 END) AS active, "
            + "SUM(CASE WHEN ptn.HanSLA BETWEEN ? AND ? THEN 1 ELSE 0 END) AS atRisk FROM PhieuTiepNhan ptn "
            + "JOIN PhanCong pc ON pc.MaPhieuTN = ptn.MaPhieuTN WHERE ptn.ConMo = 1 GROUP BY pc.MaKTV",
            row => (Id: row.Str("MaKTV")!, Load: new TechnicianLoad(row.Long("active"), row.Long("atRisk"))),
            from, to)).ToDictionary(item => item.Id, item => item.Load);

    private Task<List<string>> IdsAsync(string query, params object?[] args) => sql.QueryAsync(query, row => row.Str("MaPhieuTN")!, args);

    private static (string Sql, List<object?> Args) Where(TicketFilter filter)
    {
        var where = "FROM PhieuTiepNhan ptn JOIN KhachHang kh ON kh.MaKH = ptn.MaKH JOIN ThietBi tb ON tb.MaThietBi = ptn.MaThietBi "
            + "JOIN SanPham sp ON sp.MaSP = tb.MaSP JOIN LoaiThietBi lt ON lt.MaLoai = sp.MaLoai "
            + "LEFT JOIN PhanCong pc ON pc.MaPhieuTN = ptn.MaPhieuTN WHERE 1 = 1";
        var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var statuses = filter.Status.Split(',');
            where += $" AND ptn.TrangThaiXuLy IN ({string.Join(", ", statuses.Select(_ => "?"))})";
            args.AddRange(statuses);
        }
        if (!string.IsNullOrWhiteSpace(filter.Category))
        {
            where += " AND lt.MaNhom = ?";
            args.Add(filter.Category);
        }
        if (!string.IsNullOrWhiteSpace(filter.Technician))
        {
            where += " AND pc.MaKTV = ?";
            args.Add(filter.Technician);
        }
        if (!string.IsNullOrWhiteSpace(filter.Sla))
        {
            (where, var slaArgs) = filter.Sla switch
            {
                "BREACHED" => (where + " AND ptn.HanSLA < ?", new object?[] { filter.Now }),
                "AT_RISK" => (where + " AND ptn.HanSLA BETWEEN ? AND ?", new object?[] { filter.Now, filter.AtRiskUntil }),
                "ON_TRACK" => (where + " AND ptn.HanSLA > ?", new object?[] { filter.AtRiskUntil }),
                _ => (where + " AND 1 = 0", Array.Empty<object?>()),
            };
            args.AddRange(slaArgs);
        }
        if (filter.From is { } from)
        {
            where += " AND ptn.NgayTiepNhan >= ?";
            args.Add(from);
        }
        if (filter.To is { } to)
        {
            where += " AND ptn.NgayTiepNhan <= ?";
            args.Add(to);
        }
        if (!string.IsNullOrWhiteSpace(filter.Query))
        {
            where += " AND (ptn.MaPhieuTN LIKE ? OR tb.SoSerial_IMEI LIKE ? OR kh.SDT LIKE ?)";
            args.AddRange(Enumerable.Repeat<object?>(SqlLike.Contains(filter.Query.Trim()), 3));
        }
        return (where, args);
    }

    /// <summary>Nạp đủ aggregate cho một lô phiếu trong một lượt tới DB, giữ nguyên thứ tự mã đầu vào.</summary>
    private async Task<List<Ticket>> LoadAsync(IEnumerable<string> codes)
    {
        var result = new List<Ticket>();
        foreach (var chunk in SqlInList.Chunks(codes.Distinct()))
            result.AddRange(await LoadChunkAsync(chunk));
        return result;
    }

    private async Task<List<Ticket>> LoadChunkAsync(string[] ids)
    {
        if (ids.Length == 0) return [];
        var inList = "(" + string.Join(", ", ids.Select((_, index) => "@p" + index)) + ")";
        var tickets = new Dictionary<string, Ticket>();
        var snapshots = new Dictionary<string, (Dictionary<string, string> Customer, Dictionary<string, string> Device, string? Distributor, string? Conditions)>();
        var quotes = new Dictionary<string, string>();
        var history = new List<(string Ticket, StatusHistory Entry)>();
        var notes = new List<(string Ticket, string Type, Note Note)>();
        var assignments = new Dictionary<string, Assignment>();
        var changes = new List<(string Ticket, AssignmentHistory Change)>();
        var inspections = new Dictionary<string, Inspection>();
        var orders = new Dictionary<string, (string Ticket, RepairOrder Order)>();
        var results = new List<(string Order, RepairResult Result)>();
        var handovers = new Dictionary<string, Handover>();
        await sql.ReadBatchAsync(
            $"SELECT * FROM PhieuTiepNhan WHERE MaPhieuTN IN {inList};"
            + "SELECT ptn.MaPhieuTN, kh.HoTen, kh.SDT, kh.Email, kh.DiaChi, tb.MaSP, sp.TenSP, sp.MaHang, hs.TenHang, lt.MaNhom, lt.MaLoai, lt.TenLoai, "
            + "tb.LoaiDinhDanh, tb.SoSerial_IMEI, tb.NhaPhanPhoi, cs.DieuKienBaoHanh FROM PhieuTiepNhan ptn JOIN KhachHang kh ON kh.MaKH = ptn.MaKH "
            + "JOIN ThietBi tb ON tb.MaThietBi = ptn.MaThietBi JOIN SanPham sp ON sp.MaSP = tb.MaSP JOIN HangSanXuat hs ON hs.MaHang = sp.MaHang "
            + "JOIN LoaiThietBi lt ON lt.MaLoai = sp.MaLoai LEFT JOIN ChinhSachBaoHanh cs ON cs.MaChinhSach = ptn.BH_MaChinhSach "
            + $"WHERE ptn.MaPhieuTN IN {inList};"
            + $"SELECT MaPhieuTN, MaBaoGia FROM PhieuBaoGia WHERE MaPhieuTN IN {inList} AND TrangThaiDuyetNoiBo <> 'REJECTED';"
            + $"SELECT * FROM LichSuTrangThai_ThietBi WHERE MaPhieuTN IN {inList} ORDER BY ThoiGianCapNhat, MaLichSu;"
            + $"SELECT * FROM GhiChuPhieu WHERE MaPhieuTN IN {inList} ORDER BY ThoiGian, MaGhiChu;"
            + $"SELECT * FROM PhanCong WHERE MaPhieuTN IN {inList};"
            + $"SELECT * FROM LichSuPhanCong WHERE MaPhieuTN IN {inList} ORDER BY ThoiGian, MaLichSu;"
            + $"SELECT * FROM PhieuKiemTra WHERE MaPhieuTN IN {inList};"
            + $"SELECT * FROM PhieuSuaChua WHERE MaPhieuTN IN {inList};"
            + "SELECT kq.* FROM KetQuaSuaChua kq JOIN PhieuSuaChua sc ON sc.MaPhieuSC = kq.MaPhieuSC "
            + $"WHERE sc.MaPhieuTN IN {inList} ORDER BY kq.NgayGhiNhan, kq.MaKetQua;"
            + $"SELECT * FROM PhieuBanGiao WHERE MaPhieuTN IN {inList};",
            ids,
            row => tickets[row.Str("MaPhieuTN")!] = TicketRow(row),
            row => snapshots[row.Str("MaPhieuTN")!] = (CustomerSnapshot(row), DeviceSnapshot(row), row.Str("NhaPhanPhoi"), row.Str("DieuKienBaoHanh")),
            row => quotes[row.Str("MaPhieuTN")!] = row.Str("MaBaoGia")!,
            row => history.Add((row.Str("MaPhieuTN")!, new StatusHistory(Enum.Parse<TicketStatus>(row.Str("TrangThai")!), row.Time("ThoiGianCapNhat")!.Value,
                row.Str("MoTaChiTiet"), row.Str("NguoiCapNhat"), row.Str("TenNguoiCapNhat"), row.Str("VaiTroNguoiCapNhat")))),
            row => notes.Add((row.Str("MaPhieuTN")!, row.Str("Loai")!, new Note(row.Time("ThoiGian")!.Value, row.Str("NoiDung")!, row.Str("NguoiViet")!,
                row.Str("VaiTroNguoiViet")!))),
            row => assignments[row.Str("MaPhieuTN")!] = new Assignment(row.Str("MaPhanCong")!, row.Str("MaNVQuanLy")!, row.Str("MaKTV")!,
                row.Time("NgayPhanCong")!.Value, Enum.Parse<Priority>(row.Str("MucDoUuTien")!), row.Str("GhiChu"), []),
            row => changes.Add((row.Str("MaPhieuTN")!, new AssignmentHistory(row.Str("MaKTVCu")!, row.Str("MaKTVMoi")!, row.Str("MaNVThucHien")!,
                row.Time("ThoiGian")!.Value, row.Str("GhiChu")))),
            row => inspections[row.Str("MaPhieuTN")!] = InspectionRow(row),
            row => orders[row.Str("MaPhieuSC")!] = (row.Str("MaPhieuTN")!, new RepairOrder(row.Str("MaPhieuSC")!, row.Str("MaKTV")!,
                row.Time("NgayTao")!.Value, row.Time("NgayBatDau"), row.Str("TrangThaiSuaChua")!, [])),
            row => results.Add((row.Str("MaPhieuSC")!, new RepairResult(row.Str("MaKetQua")!, row.Str("MaKTV")!, row.Str("NoiDungSuaChua")!,
                JsonText.Objects(row.Str("KetQuaQCTungBuoc")).Select(step => new QcStep(Text(step, "Buoc"), Text(step, "KetQua"))).ToList(),
                row.Str("KetQuaKCS")!, row.Str("ChiTietTestKCS"), row.Time("NgayGhiNhan")!.Value))),
            row => handovers[row.Str("MaPhieuTN")!] = HandoverRow(row));
        foreach (var (code, ticket) in tickets)
        {
            if (snapshots.TryGetValue(code, out var snapshot))
            {
                ticket.CustomerSnapshot = snapshot.Customer;
                ticket.DeviceSnapshot = snapshot.Device;
                ticket.WarrantyAtIntake = ticket.WarrantyAtIntake with { Distributor = snapshot.Distributor, Conditions = snapshot.Conditions };
            }
            ticket.ActiveQuotationId = quotes.GetValueOrDefault(code);
            ticket.StatusHistory = history.Where(item => item.Ticket == code).Select(item => item.Entry).ToList();
            ticket.CustomerNotes = notes.Where(item => item.Ticket == code && item.Type == "CUSTOMER").Select(item => item.Note).ToList();
            ticket.InternalNotes = notes.Where(item => item.Ticket == code && item.Type == "INTERNAL").Select(item => item.Note).ToList();
            ticket.Assignment = assignments.TryGetValue(code, out var assignment)
                ? assignment with { History = changes.Where(item => item.Ticket == code).Select(item => item.Change).ToList() }
                : null;
            ticket.Inspection = inspections.GetValueOrDefault(code);
            ticket.RepairOrder = orders.Values.Where(item => item.Ticket == code)
                .Select(item => item.Order with { Results = results.Where(r => r.Order == item.Order.Code).Select(r => r.Result).ToList() })
                .FirstOrDefault();
            ticket.Handover = handovers.GetValueOrDefault(code);
        }
        return ids.Where(tickets.ContainsKey).Select(id => tickets[id]).ToList();
    }

    private static Ticket TicketRow(DbDataReader row) => new()
    {
        Id = row.Str("MaPhieuTN")!,
        StationCode = row.Str("MaTram")!,
        ReceivedAt = row.Time("NgayTiepNhan")!.Value,
        Channel = Enum.Parse<Channel>(row.Str("KenhTiepNhan")!),
        RequestType = Enum.Parse<RequestType>(row.Str("LoaiYeuCau")!),
        WarrantyRequestId = row.Str("MaYeuCau"),
        CustomerId = row.Str("MaKH")!,
        DeviceId = row.Str("MaThietBi")!,
        ReceivedBy = row.Str("MaNVTiepNhan")!,
        WarrantyAtIntake = new WarrantyAtIntake(row.Str("BH_TrangThaiLucNhan")!, row.Date("BH_NgayKichHoat"), row.Date("BH_NgayHetHan"), null, null,
            row.Str("BH_MaChinhSach")),
        SealCondition = row.Str("TinhTrangTem"),
        Cosmetic = new Cosmetic(row.Str("NQ_VetTray"), row.Bool("NQ_CanMop"), row.Bool("NQ_NutVo"), row.Str("NQ_DauHieuAmNuoc"), row.Str("NQ_PhuKien"),
            row.Str("PhuKienKemTheo"), row.Str("TinhTrangNgoaiQuan"), row.Bool("KhachXacNhanNgoaiQuan")),
        ReportedIssue = row.Str("MoTaLoiKhachBao")!,
        PromisedReturnAt = row.Time("NgayHenTra"),
        EstimatedCost = SqlMoney.Read(row.Dec("ChiPhiDuKien")),
        Sla = new Sla(Enum.Parse<SlaLevel>(row.Str("MucSLA")!), row.Time("HanSLA")!.Value),
        Status = Enum.Parse<TicketStatus>(row.Str("TrangThaiXuLy")!),
        Version = row.Int("PhienBan"),
    };

    private static Dictionary<string, string> CustomerSnapshot(DbDataReader row)
    {
        var customer = new Dictionary<string, string> { ["fullName"] = row.Str("HoTen")!, ["phone"] = row.Str("SDT")! };
        if (row.Str("Email") is { } email) customer["email"] = email;
        if (row.Str("DiaChi") is { } address) customer["address"] = address;
        return customer;
    }

    private static Dictionary<string, string> DeviceSnapshot(DbDataReader row) =>
        new (string Key, string? Value)[]
            {
                ("productId", row.Str("MaSP")), ("productName", row.Str("TenSP")), ("brandId", row.Str("MaHang")), ("brandName", row.Str("TenHang")),
                ("categoryCode", row.Str("MaNhom")), ("deviceTypeCode", row.Str("MaLoai")), ("deviceTypeName", row.Str("TenLoai")),
                ("identifierType", row.Str("LoaiDinhDanh")), ("serialOrImei", row.Str("SoSerial_IMEI")),
            }
            .Where(pair => pair.Value is not null)
            .ToDictionary(pair => pair.Key, pair => pair.Value!);

    /// <summary>Lần sửa phân loại gần nhất ghi vào NgayCapNhat; aggregate dùng thời điểm chẩn đoán hiện hành.</summary>
    private static Inspection InspectionRow(DbDataReader row) =>
        new(row.Str("MaPhieuKT")!, row.Str("MaKTV")!, row.Time("NgayCapNhat") ?? row.Time("NgayKiemTra")!.Value, row.Str("KetQuaKiemTraChiTiet")!,
            JsonText.Objects(row.Str("ChecklistKetQua")).Select(item => new ChecklistItem(Text(item, "HangMuc"), Text(item, "KetQua"), Text(item, "GhiChu"))).ToList(),
            row.Bool("TinhTrangVaoNuoc"), Enum.Parse<WarrantyClassification>(row.Str("PhanLoaiBaoHanh")!), row.Str("LyDoNgoaiBaoHanh"),
            row.Str("HuongKhacPhucDeXuat"), row.Str("GhiChuPhanLoaiLai"));

    private static Handover HandoverRow(DbDataReader row)
    {
        var recheck = row["KT_NgoaiQuanDungBienBan"] is DBNull
            ? null
            : new Recheck(row.Bool("KT_NgoaiQuanDungBienBan"), row.Bool("KT_KhoiDongBinhThuong"), row.Bool("KT_ChucNangChinhOK"),
                row.Bool("KT_PhuKienDayDu"), row.Bool("KT_KhongLoiPhatSinh"));
        var at = row.Time("NgayBanGiao")!.Value;
        return new Handover(row.Str("MaBanGiao")!, at, row.Str("MaNVBanGiao"), row.Str("NguoiNhanMay")!, row.Str("HienTrangKhiTra")!,
            row.Bool("TraLaiLinhKienCu"), row.Str("ThoiHanBaoHanhMoi"), row.IntOrNull("DanhGiaHaiLong"), recheck,
            row.LongOrNull("MaTepChuKy") is { } file ? new Signature(file.ToString(), at) : null, row.Bool("KhachXacNhanNhanMay"));
    }

    private static string? Text(Dictionary<string, System.Text.Json.JsonElement> item, string key) =>
        item.TryGetValue(key, out var value) && value.ValueKind != System.Text.Json.JsonValueKind.Null ? value.ToString() : null;

    private static string OrDefault(string? value, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value;

    private static string? Limit(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
