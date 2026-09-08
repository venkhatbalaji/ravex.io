using Wallet.Application.Abstractions;
using Wallet.Application.Contracts;
using Wallet.Application.Exceptions;
using Wallet.Domain.Repositories;
using Wallet.Domain.Transactions;

namespace Wallet.Application.UseCases;

public interface IEarnCoinsUseCase
{
    Task<EarnResult> ExecuteAsync(Guid userId, EarnRequest request, CancellationToken ct = default);
}

public sealed class EarnCoinsUseCase : IEarnCoinsUseCase
{
    private readonly IAccountRepository _accounts;
    private readonly ILedgerRepository _ledger;
    private readonly IEarnRateCatalog _rates;

    public EarnCoinsUseCase(IAccountRepository accounts, ILedgerRepository ledger, IEarnRateCatalog rates)
    {
        _accounts = accounts;
        _ledger = ledger;
        _rates = rates;
    }

    public async Task<EarnResult> ExecuteAsync(Guid userId, EarnRequest request, CancellationToken ct = default)
    {
        if (!_rates.TryGetRate(request.Reason, out var amount))
            throw new UnknownEarnReasonException(request.Reason, _rates.ValidReasons);

        var account = await _accounts.GetOrCreateForUserAsync(userId, ct);

        if (await _ledger.HasEntryTodayAsync(account.Id, request.Reason, ct))
            throw new AlreadyClaimedTodayException(request.Reason);

        var house = await _accounts.GetHouseAccountAsync(ct);
        var (debit, credit) = LedgerTransaction.Create(house.Id, account.Id, amount, request.Reason);
        await _ledger.AddRangeAsync(new[] { debit, credit }, ct);

        var balance = await _ledger.GetBalanceAsync(account.Id, ct);
        return new EarnResult(amount, balance);
    }
}
