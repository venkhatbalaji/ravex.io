using Wallet.Application.Contracts;
using Wallet.Domain.Repositories;

namespace Wallet.Application.UseCases;

public interface IGetLedgerUseCase
{
    Task<IReadOnlyList<LedgerEntryDto>> ExecuteAsync(Guid userId, int take = 50, CancellationToken ct = default);
}

public sealed class GetLedgerUseCase : IGetLedgerUseCase
{
    private readonly IAccountRepository _accounts;
    private readonly ILedgerRepository _ledger;

    public GetLedgerUseCase(IAccountRepository accounts, ILedgerRepository ledger)
    {
        _accounts = accounts;
        _ledger = ledger;
    }

    public async Task<IReadOnlyList<LedgerEntryDto>> ExecuteAsync(Guid userId, int take = 50, CancellationToken ct = default)
    {
        var account = await _accounts.GetOrCreateForUserAsync(userId, ct);
        var entries = await _ledger.GetRecentAsync(account.Id, take, ct);
        return entries.Select(e => new LedgerEntryDto(e.Amount, e.Reason, e.CreatedAt)).ToList();
    }
}
