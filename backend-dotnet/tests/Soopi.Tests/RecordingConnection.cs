using System.Data;
using System.Data.Common;
using System.Diagnostics.CodeAnalysis;
using Microsoft.Data.SqlClient;

namespace Soopi.Tests;

// Executes no SQL: records commands and returns only the rows supplied by each test.
internal sealed class RecordingConnection(Func<string, DataTable> rows) : DbConnection
{
    private ConnectionState state;
    public List<(string Sql, bool InTransaction)> Commands { get; } = [];
    public List<string> Transactions { get; } = [];
    public Func<string, int>? NonQuery { get; init; }
    public Func<string, DbDataReader>? Reader { get; init; }
    public Action? BeforeCommit { get; init; }
    public Action? BeforeRollback { get; init; }
    public Action<DbCommand>? Executing { get; init; }
    [AllowNull] public override string ConnectionString { get; set; } = "Server=unused;Database=unused";
    public override string Database => "unused";
    public override string DataSource => "unused";
    public override string ServerVersion => "16.0";
    public override ConnectionState State => state;
    public override void Open() => state = ConnectionState.Open;
    public override void Close() => state = ConnectionState.Closed;
    public override void ChangeDatabase(string databaseName) => throw new NotSupportedException();
    private DataTable Rows(string sql) => rows(sql);
    protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => new Transaction(this, isolationLevel);
    protected override DbCommand CreateDbCommand() => new Command(this);

    private sealed class Transaction(RecordingConnection connection, IsolationLevel isolation) : DbTransaction
    {
        private bool completed;
        public override IsolationLevel IsolationLevel => isolation;
        protected override DbConnection DbConnection => connection;
        public override void Commit() { connection.BeforeCommit?.Invoke(); completed = true; connection.Transactions.Add("commit"); }
        public override void Rollback() { connection.BeforeRollback?.Invoke(); completed = true; connection.Transactions.Add("rollback"); }
        protected override void Dispose(bool disposing) { if (disposing && !completed) Rollback(); base.Dispose(disposing); }
    }

    private sealed class Command(RecordingConnection connection) : DbCommand
    {
        private readonly SqlCommand parameters = new();
        [AllowNull] public override string CommandText { get; set; } = "";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; }
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection { get; set; } = connection;
        protected override DbTransaction? DbTransaction { get; set; }
        protected override DbParameterCollection DbParameterCollection => parameters.Parameters;
        protected override DbParameter CreateDbParameter() => new SqlParameter();
        public override void Cancel() => throw new NotSupportedException();
        public override void Prepare() { }
        private void Record() { connection.Commands.Add((CommandText, DbTransaction is not null)); connection.Executing?.Invoke(this); }
        public override int ExecuteNonQuery() { Record(); return connection.NonQuery?.Invoke(CommandText) ?? 1; }
        public override object? ExecuteScalar() { Record(); var table = connection.Rows(CommandText); return table.Rows.Count == 0 ? null : table.Rows[0][0]; }
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) { Record(); return connection.Reader?.Invoke(CommandText) ?? connection.Rows(CommandText).CreateDataReader(); }
    }
}
