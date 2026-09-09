using Wallet.Application.Abstractions;
using Wallet.Application.Contracts;
using Wallet.Application.Exceptions;
using Wallet.Domain.Entities;
using Wallet.Domain.Repositories;
using Wallet.Domain.Transactions;

namespace Wallet.Application.UseCases;

public interface IPlaceStakeUseCase
{
    Task<StakeResult> ExecuteAsync(Guid stakeId, PlaceStakeRequest request, CancellationToken ct = default);
}

public sealed class PlaceStakeUseCase(
    IAccountRepository accounts, ILedgerRepository ledger,
    IStakeDebitRepository debits, IWalletTransaction transactions) : IPlaceStakeUseCase
{
    public async Task<StakeResult> ExecuteAsync(Guid stakeId, PlaceStakeRequest request, CancellationToken ct = default)
    {
        if (request.Amount <= 0) throw new InvalidStakeAmountException();
        await using var transaction = await transactions.BeginAsync(request.UserId, stakeId, ct);
        var previous = await debits.GetAsync(stakeId, ct);
        if (previous is not null)
        {
            if (previous.UserId != request.UserId || previous.MarketId != request.MarketId ||
                previous.OutcomeId != request.OutcomeId || previous.Amount != request.Amount)
                throw new StakeConflictException();
            return Result(previous);
        }

        var account = await accounts.GetOrCreateForUserAsync(request.UserId, ct);
        var balance = await ledger.GetBalanceAsync(account.Id, ct);
        var accepted = balance >= request.Amount;
        if (accepted)
        {
            var pool = await accounts.GetPoolAccountAsync(ct);
            var reason = $"stake:{request.MarketId}:{request.OutcomeId}";
            var (debit, credit) = LedgerTransaction.Create(account.Id, pool.Id, request.Amount, reason);
            await ledger.AddRangeAsync(new[] { debit, credit }, ct);
            balance -= request.Amount;
        }
        var decision = StakeDebit.Decide(stakeId, request.UserId, request.MarketId,
            request.OutcomeId, request.Amount, accepted, balance);
        await debits.AddAsync(decision, ct);
        await transaction.CommitAsync(ct);
        return Result(decision);
    }

    private static StakeResult Result(StakeDebit debit) =>
        new(debit.Id, debit.Accepted, debit.Accepted ? debit.Amount : 0, debit.Balance);
}
