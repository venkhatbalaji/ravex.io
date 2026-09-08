using Wallet.Application.Contracts;
using Wallet.Domain.Repositories;

namespace Wallet.Application.UseCases;

public interface IGetBalanceUseCase
{
    Task<BalanceResult> ExecuteAsync(Guid userId, CancellationToken ct = default);
}

public sealed class GetBalanceUseCase : IGetBalanceUseCase
{
    private readonly IAccountRepository _accounts;
    private readonly ILedgerRepository _ledger;

    public GetBalanceUseCase(IAccountRepository accounts, ILedgerRepository ledger)
    {
        _accounts = accounts;
        _ledger = ledger;
    }

    public async Task<BalanceResult> ExecuteAsync(Guid userId, CancellationToken ct = default)
    {
        var account = await _accounts.GetOrCreateForUserAsync(userId, ct);
        var balance = await _ledger.GetBalanceAsync(account.Id, ct);
        return new BalanceResult(balance);
    }
}
