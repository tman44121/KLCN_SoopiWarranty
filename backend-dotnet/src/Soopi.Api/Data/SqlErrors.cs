using Microsoft.Data.SqlClient;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data;

/// <summary>
/// Đổi lỗi ràng buộc của SQL Server sang lỗi nghiệp vụ. Luật đã được kiểm tra trước khi ghi; đây là lưới an toàn khi hai
/// thao tác đua nhau cùng vượt qua kiểm tra — vd "mỗi thiết bị một phiếu mở" là filtered unique index (2601/2627).
/// </summary>
public static class SqlErrors
{
    /// <summary>2601 trùng unique index, 2627 trùng ràng buộc UNIQUE/PRIMARY KEY.</summary>
    private static readonly HashSet<int> DuplicateKey = [2601, 2627];

    /// <summary>515 NULL vào cột NOT NULL, 547 vi phạm khóa ngoại/CHECK, 2628 và 8152 chuỗi quá dài.</summary>
    private static readonly HashSet<int> InvalidData = [515, 547, 2628, 8152];

    /// <summary>1205 deadlock, 1222 hết thời gian chờ khóa (SET LOCK_TIMEOUT).</summary>
    private static readonly HashSet<int> Retryable = [1205, 1222];

    private static readonly Dictionary<string, ErrorCode> UniqueKeys = new()
    {
        ["UX_PhieuTiepNhan_ThietBiDangMo"] = ErrorCode.DEVICE_HAS_OPEN_TICKET,
        ["UX_ThietBi_SoSerial"] = ErrorCode.DEVICE_SERIAL_DUPLICATE,
        ["UX_KhachHang_SDT"] = ErrorCode.CUSTOMER_PHONE_DUPLICATE,
        ["UX_PhieuBaoGia_ConHieuLuc"] = ErrorCode.QUOTE_ACTIVE_EXISTS,
        ["UX_PhieuXuat_DangCho"] = ErrorCode.STOCK_ISSUE_PENDING_EXISTS,
        ["UX_HoaDon_PhieuTN"] = ErrorCode.PAYMENT_ALREADY_EXISTS,
        ["UX_TaiKhoan_TenDangNhap"] = ErrorCode.ACCOUNT_USERNAME_DUPLICATE,
    };

    /// <summary>Trả DomainException tương ứng nếu nhận ra lỗi, ngược lại trả nguyên ngoại lệ gốc.</summary>
    public static Exception Translate(Exception exception)
    {
        if (exception is DomainException) return exception;
        var sql = Find(exception);
        var code = sql is null ? null : CodeOf(sql);
        return code is null ? exception : new DomainException(code.Value);
    }

    public static bool IsRetryable(Exception exception) =>
        Find(exception) is { } sql && sql.Errors.Cast<SqlError>().Any(error => Retryable.Contains(error.Number));

    private static SqlException? Find(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqlException sql) return sql;
        }
        return null;
    }

    private static ErrorCode? CodeOf(SqlException exception)
    {
        if (InvalidData.Contains(exception.Number)) return ErrorCode.VALIDATION_FAILED;
        if (!DuplicateKey.Contains(exception.Number)) return null;
        var message = exception.Message;
        foreach (var (index, code) in UniqueKeys)
        {
            if (message.Contains(index, StringComparison.Ordinal)) return code;
        }
        return ErrorCode.CONCURRENT_MODIFICATION;
    }
}
