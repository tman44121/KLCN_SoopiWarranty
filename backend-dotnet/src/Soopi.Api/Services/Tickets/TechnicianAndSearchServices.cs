using Soopi.Api.Data;
using Soopi.Api.Data.Stores;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Infrastructure.Security;

namespace Soopi.Api.Services.Tickets;

public sealed record WorkloadView(
    string TechnicianId, string FullName, IReadOnlySet<string> Skills, long ActiveTickets, int MaxActiveTickets, int LoadPercent, long AtRiskSla,
    bool OnSite, bool Overloaded);

public sealed record CandidateView(
    string TechnicianId, string FullName, IReadOnlySet<string> Skills, bool SkillMatch, string Reason, long ActiveTickets, int MaxActiveTickets,
    int LoadPercent, long AtRiskSla, bool OnSite, bool Overloaded);

public sealed class TechnicianQueryService(StaffDirectory staff, TicketStore tickets, TicketQueryService views, CurrentActor actors, TimeProvider clock)
{
    public async Task<List<WorkloadView>> WorkloadAsync()
    {
        actors.Require(Permission.TICKET_ASSIGN);
        var (members, loads) = await RosterAsync();
        return members.Select(member => Workload(member, loads)).ToList();
    }

    public async Task<List<CandidateView>> CandidatesAsync(string ticketCode)
    {
        actors.Require(Permission.TICKET_ASSIGN);
        var device = (await views.RequireAsync(ticketCode)).DeviceSnapshot;
        var (members, loads) = await RosterAsync();
        return members.Select(member =>
        {
            var load = Workload(member, loads);
            var matches = new[] { "categoryCode", "deviceTypeCode", "deviceTypeName" }
                .Any(key => device.TryGetValue(key, out var value) && member.Skills.Contains(value));
            return new CandidateView(member.Code, member.FullName, member.Skills, matches,
                matches ? "Phù hợp chuyên môn thiết bị" : "Chưa có kỹ năng khớp nhóm thiết bị", load.ActiveTickets, load.MaxActiveTickets,
                load.LoadPercent, load.AtRiskSla, member.OnSite, load.Overloaded);
        }).ToList();
    }

    public async Task<List<TicketView>> MyQueueAsync()
    {
        var actor = actors.Require(Permission.TICKET_READ_ASSIGNED);
        var queue = (await tickets.SearchAsync(views.Filter(null, null, actor.EmployeeId, null, null, null, null), 0, 100))
            .Where(ticket => ticket.Open && ticket.Status is not (TicketStatus.COMPLETED or TicketStatus.CANCELLED))
            .OrderBy(ticket => ticket.Sla.DueAt)
            .ThenBy(ticket => (int)ticket.Assignment!.Priority);
        return await views.ViewsAsync(queue, actor);
    }

    private async Task<(List<StaffMember> Members, Dictionary<string, TechnicianLoad> Loads)> RosterAsync()
    {
        var now = clock.GetUtcNow();
        return (await staff.ActiveTechniciansAsync(), await tickets.TechnicianLoadsAsync(now, now + views.AtRiskThreshold));
    }

    private static WorkloadView Workload(StaffMember member, Dictionary<string, TechnicianLoad> loads)
    {
        var load = loads.GetValueOrDefault(member.Code, TechnicianLoad.None);
        var percent = (int)Math.Round(load.Active * 100.0 / member.MaxActiveTickets, MidpointRounding.AwayFromZero);
        return new WorkloadView(member.Code, member.FullName, member.Skills, load.Active, member.MaxActiveTickets, percent, load.AtRisk, member.OnSite,
            load.Active >= member.MaxActiveTickets);
    }
}

public sealed record SearchHit(string? Code, string? Status, string? Summary);

public sealed record SearchResult(
    IReadOnlyList<SearchHit> Tickets, IReadOnlyList<SearchHit> WarrantyRequests, IReadOnlyList<SearchHit> Quotations, IReadOnlyList<SearchHit> StockIssues);

/// <summary>
/// Tìm kiếm toàn cục ở header (mục 11.4): theo mã TN/YC/BG/PX, serial/IMEI, SĐT. Chỉ trả bản tóm tắt; phiếu đi qua
/// TicketQueryService nên tự áp POL-01/POL-04, các nhóm khác không chứa giá vốn hay ghi chú nội bộ.
/// </summary>
public sealed class GlobalSearchService(TicketQueryService tickets, Sql sql, CurrentActor actors)
{
    private const int Limit = 5;

    public async Task<SearchResult> SearchAsync(string? query)
    {
        var permissions = actors.RequireSignedIn().Permissions;
        var q = query?.Trim() ?? "";
        if (q.Length < 2) return new SearchResult([], [], [], []);
        var ticketHits = permissions.Contains(Permission.TICKET_READ_ALL) || permissions.Contains(Permission.TICKET_READ_ASSIGNED)
            ? (await tickets.SearchAsync(null, null, null, null, q, null, null, 0, 25)).Items.Take(Limit)
                .Select(ticket => new SearchHit(ticket.Code, ticket.Status, string.Join(" — ",
                    new[] { ticket.Customer?.FullName, ticket.Device.GetValueOrDefault("productName"), ticket.Device.GetValueOrDefault("serialOrImei") }
                        .Where(part => !string.IsNullOrWhiteSpace(part)))))
                .ToList()
            : [];
        var pattern = SqlLike.Contains(q);
        var requests = permissions.Contains(Permission.WARRANTY_REQUEST_HANDLE)
            ? await FindAsync($"SELECT TOP ({Limit}) MaYeuCau, TrangThai, CONCAT_WS(N' — ', NULLIF(HoTenKhach, ''), NULLIF(HangModel, ''), "
                + "NULLIF(SoSerial_IMEI, '')) FROM YeuCauBaoHanh WHERE MaYeuCau LIKE ? OR SDTKhach LIKE ? OR SoSerial_IMEI LIKE ?", pattern, 3)
            : [];
        var quotations = permissions.Contains(Permission.QUOTE_REVIEW)
            ? await FindAsync($"SELECT TOP ({Limit}) MaBaoGia, TrangThaiDuyetNoiBo, MaPhieuTN FROM PhieuBaoGia WHERE MaBaoGia LIKE ? OR MaPhieuTN LIKE ?", pattern, 2)
            : [];
        var stockIssues = permissions.Contains(Permission.STOCK_ISSUE_PROCESS)
            ? await FindAsync($"SELECT TOP ({Limit}) MaPhieuXuat, TrangThai, MaPhieuTN FROM PhieuXuatKho WHERE MaPhieuXuat LIKE ? OR MaPhieuTN LIKE ?", pattern, 2)
            : [];
        return new SearchResult(ticketHits, requests, quotations, stockIssues);
    }

    private Task<List<SearchHit>> FindAsync(string query, string pattern, int placeholders) =>
        sql.QueryAsync(query, row => new SearchHit(Column(row, 0), Column(row, 1), Column(row, 2)), Enumerable.Repeat<object?>(pattern, placeholders).ToArray());

    private static string? Column(System.Data.Common.DbDataReader row, int index) => row.IsDBNull(index) ? null : row.GetString(index);
}
