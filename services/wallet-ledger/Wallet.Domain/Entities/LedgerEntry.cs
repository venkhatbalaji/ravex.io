namespace Wallet.Domain.Entities;

public class LedgerEntry
{
    public Guid Id { get; private set; }
    public Guid TransactionId { get; private set; }
    public Guid AccountId { get; private set; }
    public long Amount { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }

    private LedgerEntry()
    {
        // required by EF Core for materialization
    }

    internal static LedgerEntry Create(Guid transactionId, Guid accountId, long amount, string reason, DateTimeOffset createdAt) => new()
    {
        Id = Guid.NewGuid(),
        TransactionId = transactionId,
        AccountId = accountId,
        Amount = amount,
        Reason = reason,
        CreatedAt = createdAt
    };
}
