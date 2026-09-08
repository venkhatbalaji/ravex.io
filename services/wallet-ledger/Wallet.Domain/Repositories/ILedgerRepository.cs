using Wallet.Domain.Entities;

namespace Wallet.Domain.Repositories;

public interface ILedgerRepository
{
    Task AddRangeAsync(IEnumerable<LedgerEntry> entries, CancellationToken ct = default);
    Task<long> GetBalanceAsync(Guid accountId, CancellationToken ct = default);
    Task<bool> HasEntryTodayAsync(Guid accountId, string reason, CancellationToken ct = default);
    Task<IReadOnlyList<LedgerEntry>> GetRecentAsync(Guid accountId, int take, CancellationToken ct = default);
}
