using Wallet.Domain.Entities;

namespace Wallet.Domain.Transactions;

/// <summary>
/// The only way a LedgerEntry pair gets created — guarantees every credit
/// has a matching debit of equal size, so the ledger can never drift.
/// </summary>
public static class LedgerTransaction
{
    public static (LedgerEntry Debit, LedgerEntry Credit) Create(Guid fromAccountId, Guid toAccountId, long amount, string reason)
    {
        if (amount <= 0)
            throw new ArgumentException("A ledger transaction amount must be positive.", nameof(amount));

        var transactionId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var debit = LedgerEntry.Create(transactionId, fromAccountId, -amount, reason, now);
        var credit = LedgerEntry.Create(transactionId, toAccountId, amount, reason, now);
        return (debit, credit);
    }
}
