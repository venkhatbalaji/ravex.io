using Wallet.Domain.Entities;

namespace Wallet.Domain.Repositories;

public interface IStakeDebitRepository
{
    Task<StakeDebit?> GetAsync(Guid id, CancellationToken ct);
    Task AddAsync(StakeDebit debit, CancellationToken ct);
}
