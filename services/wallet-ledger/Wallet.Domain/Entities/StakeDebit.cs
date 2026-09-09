namespace Wallet.Domain.Entities;

// A terminal decision, including insufficient funds, is saved with the ledger
// transaction. Retries must return this decision even if the balance changes.
public class StakeDebit
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid MarketId { get; private set; }
    public Guid OutcomeId { get; private set; }
    public long Amount { get; private set; }
    public bool Accepted { get; private set; }
    public long Balance { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private StakeDebit() { }

    public static StakeDebit Decide(Guid id, Guid userId, Guid marketId, Guid outcomeId,
        long amount, bool accepted, long balance) => new()
    {
        Id = id, UserId = userId, MarketId = marketId, OutcomeId = outcomeId,
        Amount = amount, Accepted = accepted, Balance = balance, CreatedAt = DateTimeOffset.UtcNow
    };
}
