using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Wallet.Application.Abstractions;

namespace Wallet.Infrastructure.Persistence;

public sealed class WalletTransaction(WalletDbContext db) : IWalletTransaction
{
    public async Task<IWalletTransactionScope> BeginAsync(Guid userId, Guid? operationId, CancellationToken ct)
    {
        var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // All debit callers acquire locks in this order. The operation lock
            // also serializes a conflicting attempt to reuse an ID for another user.
            if (operationId is { } id)
                await LockAsync($"stake:{id}", ct);
            await LockAsync($"user:{userId}", ct);
            return new Scope(transaction);
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    private Task LockAsync(string key, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);

    private sealed class Scope(IDbContextTransaction transaction) : IWalletTransactionScope
    {
        public Task CommitAsync(CancellationToken ct) => transaction.CommitAsync(ct);
        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}
