namespace Soopi.Api.Infrastructure.Errors;

/// <summary>Tên tiếng Việt của trường trong fieldErrors để câu lỗi chỉ đúng chỗ sai ("Số điện thoại không được để trống").</summary>
public static class FieldLabels
{
    private static readonly Dictionary<string, string> Labels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["fullName"] = "Họ và tên",
        ["phone"] = "Số điện thoại",
        ["email"] = "Email",
        ["address"] = "Địa chỉ",
        ["username"] = "Tên đăng nhập",
        ["password"] = "Mật khẩu",
        ["currentPassword"] = "Mật khẩu hiện tại",
        ["newPassword"] = "Mật khẩu mới",
        ["otp"] = "Mã OTP",
        ["purpose"] = "Mục đích gửi mã",
        ["code"] = "Mã phiếu",
        ["ticketCode"] = "Mã phiếu tiếp nhận",
        ["customerCode"] = "Mã khách hàng",
        ["serialOrImei"] = "Số Serial/IMEI",
        ["identifierType"] = "Loại định danh (Serial/IMEI)",
        ["categoryCode"] = "Loại thiết bị",
        ["deviceTypeCode"] = "Dòng thiết bị",
        ["brandModel"] = "Hãng / Model",
        ["symptom"] = "Mô tả lỗi",
        ["reportedIssue"] = "Lỗi khách báo",
        ["preferredStation"] = "Trạm dịch vụ",
        ["productId"] = "Sản phẩm",
        ["technicianId"] = "Kỹ thuật viên",
        ["reason"] = "Lý do",
        ["note"] = "Ghi chú",
        ["payerName"] = "Người nộp tiền",
        ["method"] = "Phương thức thanh toán",
        ["expectedAmount"] = "Số tiền",
        ["receiverName"] = "Người nhận",
        ["conditionOnReturn"] = "Tình trạng khi trả",
        ["findings"] = "Kết quả kiểm tra",
        ["workDone"] = "Công việc đã làm",
        ["qcResult"] = "Kết quả KCS",
        ["sku"] = "Mã linh kiện",
        ["quantity"] = "Số lượng",
        ["unitPrice"] = "Đơn giá",
        ["binCode"] = "Kệ/ngăn",
        ["fromBin"] = "Kệ/ngăn nguồn",
        ["toBin"] = "Kệ/ngăn đích",
        ["supplierId"] = "Nhà cung cấp",
        ["roles"] = "Vai trò",
        ["rating"] = "Số sao đánh giá",
        ["comment"] = "Nhận xét",
        ["text"] = "Nội dung",
        ["lines"] = "Chi tiết",
    };

    /// <summary>"customer.phone" → "Số điện thoại"; "lines[0].sku" → "Mã linh kiện (dòng 1)"; không có trong bảng → giữ tên trường.</summary>
    public static string Of(string field)
    {
        var segment = field.Split('.')[^1];
        var bracket = segment.IndexOf('[');
        var name = bracket < 0 ? segment : segment[..bracket];
        var label = Labels.GetValueOrDefault(name, name);
        var parent = field.Split('.') is { Length: > 1 } parts ? parts[^2] : "";
        var index = parent.IndexOf('[');
        return index >= 0 && int.TryParse(parent[(index + 1)..^1], out var row) ? $"{label} (dòng {row + 1})" : label;
    }

    /// <summary>Câu tóm tắt cho detail: "Vui lòng kiểm tra lại: Số điện thoại không được để trống; Email …".</summary>
    public static string Summary(IReadOnlyList<FieldErrorView> errors) =>
        "Vui lòng kiểm tra lại: " + string.Join("; ", errors.Select(error => Of(error.Field) + " " + error.Message)) + ".";
}
