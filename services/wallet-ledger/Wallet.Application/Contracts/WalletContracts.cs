namespace Wallet.Application.Contracts;

public record EarnRequest(string Reason);
public record EarnResult(long Credited, long Balance);
public record BalanceResult(long Balance);
public record LedgerEntryDto(long Amount, string Reason, DateTimeOffset CreatedAt);
public record PlaceStakeRequest(Guid UserId, Guid MarketId, Guid OutcomeId, long Amount);
public record StakeResult(Guid StakeId, bool Accepted, long Debited, long Balance);

public record RewardOption(string Reason, long Amount, bool Available, DateTimeOffset? NextAvailableAt);
public record RewardsResult(DateTimeOffset ObservedAt, IReadOnlyList<RewardOption> Items);
