using Wallet.Domain.Entities;

namespace Wallet.Domain.Repositories;

public interface IAccountRepository
{
    Task<Account> GetOrCreateForUserAsync(Guid userId, CancellationToken ct = default);
    Task<Account> GetHouseAccountAsync(CancellationToken ct = default);
    Task<Account> GetPoolAccountAsync(CancellationToken ct = default);
    Task EnsureSystemAccountsSeededAsync(CancellationToken ct = default);
}
