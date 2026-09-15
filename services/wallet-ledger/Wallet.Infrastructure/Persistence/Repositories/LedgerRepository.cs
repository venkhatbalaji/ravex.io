using Microsoft.EntityFrameworkCore;
using Wallet.Domain.Entities;
using Wallet.Domain.Repositories;

namespace Wallet.Infrastructure.Persistence.Repositories;

public sealed class LedgerRepository : ILedgerRepository
{
    private readonly WalletDbContext _db;

    public LedgerRepository(WalletDbContext db) => _db = db;

    public async Task AddRangeAsync(IEnumerable<LedgerEntry> entries, CancellationToken ct = default)
    {
        _db.LedgerEntries.AddRange(entries);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<long> GetBalanceAsync(Guid accountId, CancellationToken ct = default) =>
        await _db.LedgerEntries.Where(e => e.AccountId == accountId).SumAsync(e => (long?)e.Amount, ct) ?? 0;

    public Task<DateTimeOffset?> GetLastEarnAtAsync(Guid userId, string reason, CancellationToken ct = default) =>
        (from entry in _db.LedgerEntries
         join account in _db.Accounts on entry.AccountId equals account.Id
         where account.OwnerUserId == userId && entry.Reason == reason && entry.Amount > 0
         select (DateTimeOffset?)entry.CreatedAt).MaxAsync(ct);

    public async Task<IReadOnlyList<LedgerEntry>> GetRecentAsync(Guid accountId, int take, CancellationToken ct = default) =>
        await _db.LedgerEntries
            .Where(e => e.AccountId == accountId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(take)
            .ToListAsync(ct);
}
