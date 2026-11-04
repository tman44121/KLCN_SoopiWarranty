using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Soopi.Api.Data;
using Soopi.Api.Services.Files;

namespace Soopi.Tests;

public class FileRollbackTests
{
    [Theory]
    [InlineData("operation")]
    [InlineData("commit")]
    [InlineData("retry")]
    [InlineData("success")]
    [InlineData("after-commit")]
    [InlineData("after-commit-retryable")]
    [InlineData("unknown-commit")]
    public async Task FilesFollowTheOutcomeOfEachTransactionAttempt(string failure)
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "upload-tests", Guid.NewGuid().ToString()));
        Directory.CreateDirectory(root);
        try
        {
            var rollbacks = 0;
            using var connection = new RecordingConnection(_ =>
            {
                var table = new DataTable(); table.Columns.Add("MaTep", typeof(long)); table.Rows.Add(1L); return table;
            })
            {
                BeforeCommit = () => { if (failure is "commit" or "unknown-commit") throw new InvalidOperationException("Commit failed"); },
                BeforeRollback = () => { if (failure == "unknown-commit" && ++rollbacks == 1) throw new IOException("Connection lost"); },
            };
            using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
            var transactions = new TransactionRunner(db);
            using var services = new ServiceCollection().AddSingleton(new Sql(db)).AddSingleton<TimeProvider>(TimeProvider.System)
                .AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Directory"] = root }).Build())
                .AddSingleton(transactions).BuildServiceProvider();
            var storage = ActivatorUtilities.CreateInstance<FileStorage>(services);
            var attempt = 0;
            var exception = await Record.ExceptionAsync(() => transactions.InTransactionAsync(async () =>
            {
                if (++attempt > 1) Assert.Empty(Directory.GetFiles(root, "*", SearchOption.AllDirectories));
                await storage.StoreAsync("test.png", "image/png", [1, 2, 3], new FileOwner("WARRANTY_REQUEST", "YC-1", null, null));
                if (failure == "operation") throw new InvalidOperationException("Notification failed");
                if (failure == "retry" && attempt == 1) throw new DbUpdateConcurrencyException();
                if (failure == "after-commit") transactions.AfterCommit(() => throw new InvalidOperationException("Push scheduling failed"));
                if (failure == "after-commit-retryable") transactions.AfterCommit(() => throw new DbUpdateConcurrencyException());
            }));

            if (failure is "success" or "retry") Assert.Null(exception);
            else if (failure == "after-commit-retryable") Assert.IsType<DbUpdateConcurrencyException>(exception);
            else if (failure == "unknown-commit") Assert.IsType<AggregateException>(exception);
            else Assert.IsType<InvalidOperationException>(exception);
            var files = Directory.GetFiles(root, "*", SearchOption.AllDirectories);
            if (failure is "operation" or "commit") Assert.Empty(files);
            else Assert.Single(files);
            Assert.Equal(failure == "retry" ? 2 : 1, attempt);
        }
        finally
        {
            Assert.StartsWith(Path.GetFullPath(AppContext.BaseDirectory), root);
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task FailedCleanup_DoesNotPreventOtherFilesFromBeingCleaned()
    {
        using var connection = new RecordingConnection(_ => new DataTable());
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options);
        var transactions = new TransactionRunner(db);
        var cleaned = false;
        var error = await Assert.ThrowsAsync<AggregateException>(() => transactions.InTransactionAsync(() =>
        {
            transactions.AfterRollback(() => throw new IOException("First file is locked"));
            transactions.AfterRollback(() =>
            {
                Assert.Null(db.Database.CurrentTransaction);
                Assert.Contains("rollback", connection.Transactions);
                cleaned = true;
            });
            throw new InvalidOperationException("Business write failed");
        }));
        Assert.True(cleaned);
        Assert.Contains(error.InnerExceptions, exception => exception is InvalidOperationException);
        Assert.Contains(error.InnerExceptions, exception => exception is IOException);
    }
}
