using System.Data;
using Microsoft.EntityFrameworkCore;
using Soopi.Api.Domain.Shared;

namespace Soopi.Api.Data;

/// <summary>
/// Chạy một use case trong một transaction READ COMMITTED (database bật READ_COMMITTED_SNAPSHOT). Xung đột phiên bản
/// (optimistic lock) và deadlock/lock timeout được thử lại tối đa 3 lần rồi mới báo CONCURRENT_MODIFICATION. Gọi lồng
/// thì tham gia transaction bên ngoài (như PROPAGATION_REQUIRED của Spring). Việc đăng ký bằng <see cref="AfterCommit"/>
/// chỉ chạy sau khi commit.
/// </summary>
public sealed class TransactionRunner(AppDbContext db)
{
    private const int MaxAttempts = 3;
    private readonly List<Action> afterCommit = [];

    public async Task<T> InTransactionAsync<T>(Func<Task<T>> operation)
    {
        if (db.Database.CurrentTransaction is not null) return await operation();
        for (var attempt = 1; ; attempt++)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            try
            {
                var result = await operation();
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
                RunAfterCommit();
                return result;
            }
            catch (Exception exception)
            {
                // Transaction chưa commit tự rollback khi dispose (cuối vòng lặp hoặc khi ném lỗi).
                db.ChangeTracker.Clear();
                afterCommit.Clear();
                var translated = SqlErrors.Translate(exception);
                var retryable = translated is not DomainException
                    && (exception is DbUpdateConcurrencyException || SqlErrors.IsRetryable(exception));
                if (!retryable)
                {
                    if (ReferenceEquals(translated, exception)) throw;
                    throw translated;
                }
                if (attempt == MaxAttempts) throw new DomainException(ErrorCode.CONCURRENT_MODIFICATION);
            }
        }
    }

    public Task InTransactionAsync(Func<Task> operation) =>
        InTransactionAsync(async () =>
        {
            await operation();
            return true;
        });

    /// <summary>Chạy sau khi transaction hiện tại commit; ngoài transaction thì chạy ngay.</summary>
    public void AfterCommit(Action action)
    {
        if (db.Database.CurrentTransaction is null) action();
        else afterCommit.Add(action);
    }

    private void RunAfterCommit()
    {
        var actions = afterCommit.ToList();
        afterCommit.Clear();
        actions.ForEach(action => action());
    }
}
