using Wallet.Application.Abstractions;
using Wallet.Application.Contracts;
using Wallet.Domain.Repositories;

namespace Wallet.Application.UseCases;

public sealed class GetRewardsUseCase(ILedgerRepository ledger, IEarnRateCatalog rates)
{
    public async Task<RewardsResult> ExecuteAsync(Guid userId, CancellationToken ct)
    {
        var observedAt = DateTimeOffset.UtcNow;
        var lastClaim = await ledger.GetLastEarnAtAsync(userId, "daily_login", ct);
        var today = new DateTimeOffset(observedAt.UtcDateTime.Date, TimeSpan.Zero);
        var available = lastClaim is null || lastClaim < today;
        if (!rates.TryGetRate("daily_login", out var amount))
            throw new InvalidOperationException("Daily reward rate is missing.");
        var next = available ? (DateTimeOffset?)null : new DateTimeOffset(lastClaim!.Value.UtcDateTime.Date, TimeSpan.Zero).AddDays(1);
        return new(observedAt, new[] { new RewardOption("daily_login", amount, available, next) });
    }
}
