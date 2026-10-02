using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Soopi.Api.Data;

/// <summary>
/// SQL Server mặc định chờ khóa vô hạn; hết 10 s báo lỗi 1222 → TransactionRunner thử lại (bản Java đặt bằng
/// connection-init-sql của Hikari). Gắn vào đầu mỗi lệnh thay vì một lượt riêng khi mở kết nối, để không tốn thêm một
/// vòng mạng tới database ở xa.
/// </summary>
public sealed class LockTimeoutInterceptor : DbCommandInterceptor
{
    private const string Prefix = "SET LOCK_TIMEOUT 10000;\n";

    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Apply(command);
        return result;
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Apply(command);
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult<int> NonQueryExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    {
        Apply(command);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Apply(command);
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult<object> ScalarExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    {
        Apply(command);
        return result;
    }

    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result, CancellationToken cancellationToken = default)
    {
        Apply(command);
        return ValueTask.FromResult(result);
    }

    public static void Apply(DbCommand command)
    {
        if (!command.CommandText.StartsWith(Prefix, StringComparison.Ordinal)) command.CommandText = Prefix + command.CommandText;
    }
}
