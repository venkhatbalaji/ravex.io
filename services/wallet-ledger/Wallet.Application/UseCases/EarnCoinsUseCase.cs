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
    private readonly IWalletTransaction _transactions;

    public EarnCoinsUseCase(IAccountRepository accounts, ILedgerRepository ledger, IEarnRateCatalog rates, IWalletTransaction transactions)
    {
        _accounts = accounts;
        _ledger = ledger;
        _rates = rates;
        _transactions = transactions;
    }

    public async Task<EarnResult> ExecuteAsync(Guid userId, EarnRequest request, CancellationToken ct = default)
    {
        // A rate is not evidence of an ad view or a successful referral.
        // Only this explicit self-claim policy can authorize public minting.
        if (request.Reason is "rewarded_ad" or "referral")
            throw new RewardVerificationRequiredException();
        if (request.Reason != "daily_login" || !_rates.TryGetRate(request.Reason, out var amount))
            throw new UnknownEarnReasonException(request.Reason, _rates.ValidReasons);

        await using var transaction = await _transactions.BeginAsync(userId, null, ct);
        var account = await _accounts.GetOrCreateForUserAsync(userId, ct);

        var claimedAt = DateTimeOffset.UtcNow;
        var today = new DateTimeOffset(claimedAt.UtcDateTime.Date, TimeSpan.Zero);
        if (await _ledger.GetLastEarnAtAsync(userId, request.Reason, ct) is { } previous && previous >= today)
            throw new AlreadyClaimedTodayException(request.Reason);

        var house = await _accounts.GetHouseAccountAsync(ct);
        var (debit, credit) = LedgerTransaction.Create(house.Id, account.Id, amount, request.Reason, claimedAt);
        await _ledger.AddRangeAsync(new[] { debit, credit }, ct);

        var balance = await _ledger.GetBalanceAsync(account.Id, ct);
        await transaction.CommitAsync(ct);
        return new EarnResult(amount, balance);
    }
}
