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

    public Task<bool> HasEntryTodayAsync(Guid accountId, string reason, CancellationToken ct = default)
    {
        var todayStartUtc = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);
        return _db.LedgerEntries.AnyAsync(
            e => e.AccountId == accountId && e.Reason == reason && e.CreatedAt >= todayStartUtc, ct);
    }

    public async Task<IReadOnlyList<LedgerEntry>> GetRecentAsync(Guid accountId, int take, CancellationToken ct = default) =>
        await _db.LedgerEntries
            .Where(e => e.AccountId == accountId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(take)
            .ToListAsync(ct);
}
