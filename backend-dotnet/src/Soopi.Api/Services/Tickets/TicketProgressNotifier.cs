using System.Globalization;
using Soopi.Api.Data;
using Soopi.Api.Domain.Tickets;
using Soopi.Api.Services.Billing;
using Soopi.Api.Services.Shared;

namespace Soopi.Api.Services.Tickets;

/// <summary>Trạm nhận máy và số tiền khách cần trả khi nhận — chỉ dùng để ghép câu thông báo.</summary>
public sealed record PickupInfo(string? StationName, string? StationAddress, decimal? AmountDue, string Hours = TicketProgressMessages.PickupHours);

/// <summary>
/// Câu thông báo tiến độ gửi khách theo trạng thái mới của phiếu. Báo giá chờ khách xác nhận và bàn giao có thông báo riêng
/// ở dịch vụ báo giá/bàn giao nên không lặp lại ở đây.
/// </summary>
public static class TicketProgressMessages
{
    public const string PickupHours = "thứ Hai – thứ Bảy, 08:00 – 17:00";

    /// <summary>Cột ThongBao.NoiDung là NVARCHAR(255).</summary>
    public const int MaxLength = 255;
    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>Quá 255 ký tự thì bỏ địa chỉ trạm trước; vẫn quá mới cắt và thêm "…".</summary>
    public static (string Type, string Message)? For(Ticket ticket, TicketStatus status, PickupInfo pickup)
    {
        var message = Compose(ticket, status, pickup);
        if (message is { } full && full.Message.Length > MaxLength && !string.IsNullOrWhiteSpace(pickup.StationAddress))
            message = Compose(ticket, status, pickup with { StationAddress = null });
        return message is { } value && value.Message.Length > MaxLength ? (value.Type, value.Message[..(MaxLength - 1)] + "…") : message;
    }

    private static (string Type, string Message)? Compose(Ticket ticket, TicketStatus status, PickupInfo pickup)
    {
        var code = ticket.Id;
        var device = Device(ticket);
        var promised = ticket.PromisedReturnAt is { } at ? $" Ngày hẹn trả dự kiến: {Time(at)}." : "";
        var station = Station(pickup);
        return status switch
        {
            TicketStatus.RECEIVED => ("TICKET_RECEIVED",
                $"Trung tâm đã tiếp nhận {device} — mã phiếu {code}.{promised} Bạn có thể theo dõi tiến độ bằng mã phiếu hoặc số Serial."),
            TicketStatus.INSPECTING => ("TICKET_INSPECTING", $"Kỹ thuật viên đã nhận {device} (phiếu {code}) và đang kiểm tra lỗi."),
            TicketStatus.DIAGNOSED => ("TICKET_DIAGNOSED", Diagnosis(ticket, device)),
            TicketStatus.AWAITING_PARTS => ("TICKET_AWAITING_PARTS",
                $"Phiếu {code}: đang chờ linh kiện thay thế cho {device}. Trung tâm sẽ báo ngay khi bắt đầu sửa.{promised}"),
            TicketStatus.REPAIRING => ("TICKET_REPAIRING", $"Kỹ thuật viên đã bắt đầu sửa {device} (phiếu {code}).{promised}"),
            TicketStatus.COMPLETED => ("TICKET_COMPLETED",
                $"{Capitalize(device)} (phiếu {code}) đã sửa xong, đạt kiểm tra chất lượng. Mời bạn nhận máy{station}, {pickup.Hours}. "
                + Amount(pickup.AmountDue)),
            TicketStatus.AWAITING_RETURN => ("TICKET_AWAITING_RETURN",
                ticket.StatusHistory.LastOrDefault()?.Description == Domain.Quotations.Quotation.ExpirationReason
                    ? $"Báo giá của phiếu {code} đã hết hạn xác nhận và tự động bị từ chối. Mời bạn đến nhận lại máy nguyên trạng{station}, {pickup.Hours}."
                    : $"Phiếu {code}: {device} sẽ được trả nguyên trạng, không sửa chữa. Mời bạn đến nhận lại máy{station}, {pickup.Hours}."),
            _ => null,
        };
    }

    private static string Diagnosis(Ticket ticket, string device)
    {
        var inspection = ticket.Inspection;
        var head = $"Đã kiểm tra xong {device} (phiếu {ticket.Id})";
        if (inspection is null) return head + ".";
        return inspection.Classification switch
        {
            WarrantyClassification.FREE_WARRANTY => head + ": lỗi thuộc phạm vi bảo hành, sửa miễn phí. Kỹ thuật viên sẽ tiến hành sửa chữa.",
            WarrantyClassification.PARTIAL_WARRANTY =>
                head + ": một phần lỗi được bảo hành, phần còn lại tính phí. Trung tâm sẽ gửi báo giá để bạn xác nhận trước khi sửa.",
            _ => head + ": lỗi nằm ngoài phạm vi bảo hành"
                + (string.IsNullOrWhiteSpace(inspection.OutOfWarrantyReason) ? "" : $" ({inspection.OutOfWarrantyReason.Trim().TrimEnd('.')})")
                + ". Trung tâm sẽ gửi báo giá để bạn xác nhận trước khi sửa.",
        };
    }

    private static string Device(Ticket ticket)
    {
        var brand = ticket.DeviceSnapshot.GetValueOrDefault("brandName");
        var product = ticket.DeviceSnapshot.GetValueOrDefault("productName");
        var name = string.Join(" ", new[] { brand, product }.Where(part => !string.IsNullOrWhiteSpace(part)));
        return name.Length == 0 ? "thiết bị của bạn" : "thiết bị " + name;
    }

    private static string Station(PickupInfo pickup) =>
        string.IsNullOrWhiteSpace(pickup.StationName) ? " tại trung tâm"
            : $" tại {pickup.StationName}" + (string.IsNullOrWhiteSpace(pickup.StationAddress) ? "" : $" ({pickup.StationAddress})");

    private static string Amount(decimal? amount) => amount switch
    {
        null => "",
        0 => "Không phát sinh chi phí.",
        var value => $"Thanh toán khi nhận máy: {((long)value.Value).ToString("#,##0", Vietnamese)} đ.",
    };

    private static string Time(DateTimeOffset at) => at.ToOffset(DbTime.Offset).ToString("HH:mm 'ngày' dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static string Capitalize(string text) => text.Length == 0 ? text : char.ToUpper(text[0], Vietnamese) + text[1..];
}

/// <summary>Gửi khách thông báo theo trạng thái mới nhất mỗi lần phiếu được lưu (một thao tác qua nhiều bước chỉ báo bước cuối).</summary>
public sealed class TicketProgressNotifier(Sql sql, NotificationService notifications, BillingCalculator billing, TimeSettingsService timeSettings)
{
    public async Task StatusChangedAsync(Ticket ticket, int previousHistoryCount)
    {
        if (ticket.StatusHistory.Count <= previousHistoryCount) return;
        var status = ticket.StatusHistory[^1].Status;
        if (status is not (TicketStatus.RECEIVED or TicketStatus.INSPECTING or TicketStatus.DIAGNOSED or TicketStatus.AWAITING_PARTS
            or TicketStatus.REPAIRING or TicketStatus.COMPLETED or TicketStatus.AWAITING_RETURN)) return;
        var needsPickup = status is TicketStatus.COMPLETED or TicketStatus.AWAITING_RETURN;
        var station = needsPickup
            ? await sql.FirstOrDefaultAsync("SELECT TenTram, DiaChi FROM TramDichVu WHERE MaTram = ?",
                row => (Name: row.Str("TenTram"), Address: row.Str("DiaChi")), ticket.StationCode)
            : default;
        var amount = status == TicketStatus.COMPLETED ? (await billing.BreakdownAsync(ticket.Id)).Total : (decimal?)null;
        if (TicketProgressMessages.For(ticket, status, new PickupInfo(station.Name, station.Address, amount,
            needsPickup ? (await timeSettings.GetAsync()).HoursText : TicketProgressMessages.PickupHours)) is { } message)
            await notifications.ForCustomerAsync(ticket.CustomerId, message.Type, message.Message, ticket.Id);
    }
}
