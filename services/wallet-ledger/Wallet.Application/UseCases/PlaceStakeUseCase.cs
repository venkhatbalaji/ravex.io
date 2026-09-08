using Wallet.Application.Contracts;
using Wallet.Application.Exceptions;
using Wallet.Domain.Repositories;
using Wallet.Domain.Transactions;

namespace Wallet.Application.UseCases;

public interface IPlaceStakeUseCase
{
    Task<StakeResult> ExecuteAsync(Guid userId, PlaceStakeRequest request, CancellationToken ct = default);
}

/// <summary>
/// Moves coins from a player's account into escrow (the Pool account) for an
/// open market. Called by the Settlement Engine before it accepts a stake
/// into a pool — a stake that isn't backed by a real debit here never happened.
/// </summary>
public sealed class PlaceStakeUseCase : IPlaceStakeUseCase
{
    private readonly IAccountRepository _accounts;
    private readonly ILedgerRepository _ledger;

    public PlaceStakeUseCase(IAccountRepository accounts, ILedgerRepository ledger)
    {
        _accounts = accounts;
        _ledger = ledger;
    }

    public async Task<StakeResult> ExecuteAsync(Guid userId, PlaceStakeRequest request, CancellationToken ct = default)
    {
        if (request.Amount <= 0)
            throw new InvalidStakeAmountException();

        var account = await _accounts.GetOrCreateForUserAsync(userId, ct);
        var balance = await _ledger.GetBalanceAsync(account.Id, ct);
        if (balance < request.Amount)
            throw new InsufficientBalanceException(balance, request.Amount);

        var pool = await _accounts.GetPoolAccountAsync(ct);
        var reason = $"stake:{request.MarketId}:{request.OutcomeId}";
        var (debit, credit) = LedgerTransaction.Create(account.Id, pool.Id, request.Amount, reason);
        await _ledger.AddRangeAsync(new[] { debit, credit }, ct);

        var newBalance = await _ledger.GetBalanceAsync(account.Id, ct);
        return new StakeResult(request.Amount, newBalance);
    }
}
