using System.Data.Common;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Soopi.Api.Data;

/// <summary>
/// Tương đương JdbcTemplate: chạy T-SQL viết tay trên cùng kết nối và transaction của AppDbContext. Tham số theo vị trí
/// dấu <c>?</c> (giữ nguyên câu SQL của bản Java); DateTimeOffset được ghi thành giờ Việt Nam (DbTime).
/// </summary>
public sealed class Sql(AppDbContext db)
{
    /// <summary>Đang trong transaction ghi: đọc chứng từ kèm khóa (UPDLOCK, HOLDLOCK) như PESSIMISTIC_WRITE của Java.</summary>
    public bool InTransaction => db.Database.CurrentTransaction is not null;

    public string LockHint => InTransaction ? " WITH (UPDLOCK, HOLDLOCK)" : "";

    public async Task<List<T>> QueryAsync<T>(string sql, Func<DbDataReader, T> map, params object?[] args)
    {
        await using var command = await CommandAsync(sql, args);
        await using var reader = await command.ExecuteReaderAsync();
        var result = new List<T>();
        while (await reader.ReadAsync()) result.Add(map(reader));
        return result;
    }

    public async Task<T?> FirstOrDefaultAsync<T>(string sql, Func<DbDataReader, T> map, params object?[] args)
    {
        var rows = await QueryAsync(sql, map, args);
        return rows.Count == 0 ? default : rows[0];
    }

    public async Task<int> ExecuteAsync(string sql, params object?[] args)
    {
        await using var command = await CommandAsync(sql, args);
        return await command.ExecuteNonQueryAsync();
    }

    public async Task<object?> ScalarAsync(string sql, params object?[] args)
    {
        await using var command = await CommandAsync(sql, args);
        var value = await command.ExecuteScalarAsync();
        return value is DBNull ? null : value;
    }

    /// <summary>
    /// Nhiều câu SELECT trong một lượt tới DB (thay ConcurrentReads của Java): câu SQL dùng sẵn tên @p0, @p1… cho
    /// <paramref name="args"/>; mỗi result set lần lượt đưa cho một <paramref name="readers"/>.
    /// </summary>
    public async Task ReadBatchAsync(string sql, IReadOnlyList<object?> args, params Action<DbDataReader>[] readers)
    {
        await using var command = await CommandAsync(sql, [.. args], positional: false);
        await using var reader = await command.ExecuteReaderAsync();
        foreach (var read in readers)
        {
            while (await reader.ReadAsync()) read(reader);
            await reader.NextResultAsync();
        }
    }

    private async Task<DbCommand> CommandAsync(string sql, object?[] args, bool positional = true)
    {
        await db.Database.OpenConnectionAsync();
        var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = positional ? Positional(sql, args.Length) : sql;
        for (var index = 0; index < args.Length; index++)
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = "@p" + index;
            parameter.Value = ToDb(args[index]);
            command.Parameters.Add(parameter);
        }
        LockTimeoutInterceptor.Apply(command);
        return command;
    }

    private static string Positional(string sql, int count)
    {
        var builder = new StringBuilder(sql.Length + count * 3);
        var index = 0;
        foreach (var character in sql)
        {
            if (character == '?') builder.Append("@p").Append(index++);
            else builder.Append(character);
        }
        if (index != count) throw new ArgumentException($"Câu SQL có {index} tham số nhưng nhận {count} giá trị");
        return builder.ToString();
    }

    private static object ToDb(object? value) => value switch
    {
        null => DBNull.Value,
        DateTimeOffset instant => DbTime.Local(instant),
        DateOnly date => date.ToDateTime(TimeOnly.MinValue),
        Enum item => item.ToString(),
        _ => value,
    };
}

/// <summary>Đọc cột theo tên như ResultSet; null an toàn.</summary>
public static class DbRow
{
    public static string? Str(this DbDataReader row, string column) =>
        row[column] is DBNull ? null : Convert.ToString(row[column], System.Globalization.CultureInfo.InvariantCulture);

    public static int Int(this DbDataReader row, string column) => Convert.ToInt32(row[column]);

    public static int? IntOrNull(this DbDataReader row, string column) => row[column] is DBNull ? null : Convert.ToInt32(row[column]);

    public static long Long(this DbDataReader row, string column) => Convert.ToInt64(row[column]);

    public static long? LongOrNull(this DbDataReader row, string column) => row[column] is DBNull ? null : Convert.ToInt64(row[column]);

    public static decimal Dec(this DbDataReader row, string column) => Convert.ToDecimal(row[column]);

    public static decimal? DecOrNull(this DbDataReader row, string column) => row[column] is DBNull ? null : Convert.ToDecimal(row[column]);

    public static bool Bool(this DbDataReader row, string column) => row[column] is not DBNull && Convert.ToBoolean(row[column]);

    public static DateTimeOffset? Time(this DbDataReader row, string column) =>
        row[column] is DBNull ? null : DbTime.Instant((DateTime)row[column]);

    public static DateOnly? Date(this DbDataReader row, string column) =>
        row[column] switch
        {
            DBNull => null,
            DateOnly date => date,
            DateTime value => DateOnly.FromDateTime(value),
            var other => throw new InvalidCastException($"Không đọc được ngày từ {other.GetType()}"),
        };
}
