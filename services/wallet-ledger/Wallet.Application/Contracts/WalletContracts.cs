namespace Wallet.Application.Contracts;

public record EarnRequest(string Reason);
public record EarnResult(long Credited, long Balance);
public record BalanceResult(long Balance);
public record LedgerEntryDto(long Amount, string Reason, DateTimeOffset CreatedAt);
public record PlaceStakeRequest(string MarketId, string OutcomeId, long Amount);
public record StakeResult(long Debited, long Balance);
