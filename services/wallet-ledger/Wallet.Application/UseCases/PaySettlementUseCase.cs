using System.Security.Cryptography;
using System.Text.Json;
using Wallet.Application.Abstractions;
using Wallet.Application.Exceptions;
using Wallet.Domain.Entities;
using Wallet.Domain.Repositories;
using Wallet.Domain.Transactions;

namespace Wallet.Application.UseCases;

public record PayoutItem(Guid StakeId, Guid UserId, long Amount);
public record PaySettlementRequest(string Kind, List<PayoutItem> Payouts);
public record PaymentResult(Guid MarketId, long Total);
public sealed class InvalidPayoutException(string message) : Exception(message);

public sealed class PaySettlementUseCase(IAccountRepository accounts, ILedgerRepository ledger,
    IStakeDebitRepository debits, ISettlementReceiptRepository receipts, IWalletTransaction transactions)
{
    public async Task<PaymentResult> ExecuteAsync(Guid marketId, PaySettlementRequest request, CancellationToken ct)
    {
        if (marketId == Guid.Empty || request.Kind is not ("payout" or "refund") || request.Payouts is null ||
            request.Payouts.Any(p => p.StakeId == Guid.Empty || p.UserId == Guid.Empty || p.Amount < 0) ||
            request.Payouts.Select(p => p.StakeId).Distinct().Count() != request.Payouts.Count)
            throw new InvalidPayoutException("Invalid payout plan.");
        var ordered = request.Payouts.OrderBy(p => p.StakeId).ToList();
        var hash = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new { request.Kind, Payouts = ordered })));
        await using var tx = await transactions.BeginAsync(Account.PoolAccountId, marketId, ct, marketId);
        var previous = await receipts.GetAsync(marketId, ct);
        if (previous is not null)
        {
            if (previous.PayloadHash != hash) throw new StakeConflictException();
            return new(marketId, previous.Total);
        }
        var paidStakes = await debits.ForMarketAsync(marketId, ct);
        var lookup = paidStakes.ToDictionary(d => d.Id);
        if (lookup.Count != ordered.Count || ordered.Any(p => !lookup.TryGetValue(p.StakeId, out var d) ||
            d.UserId != p.UserId || (request.Kind == "refund" && p.Amount != d.Amount)))
            throw new InvalidPayoutException("Payouts must account for every accepted stake and its owner.");
        var total = ordered.Sum(p => p.Amount);
        if (total != paidStakes.Sum(d => d.Amount)) throw new InvalidPayoutException("Payout total must equal this market's escrowed stakes.");
        var pool = await accounts.GetPoolAccountAsync(ct);
        if (await ledger.GetBalanceAsync(pool.Id, ct) < total) throw new InvalidPayoutException("Escrow cannot fund this payout plan.");
        // Serialize recipients in a fixed order; each market pays in one atomic
        // transaction, so a crash cannot leave only some winners credited.
        var entries = new List<LedgerEntry>();
        foreach (var group in ordered.GroupBy(p => p.UserId).OrderBy(g => g.Key))
        {
            var amount = group.Sum(p => p.Amount);
            if (amount == 0) continue;
            await tx.LockUserAsync(group.Key, ct);
            var account = await accounts.GetOrCreateForUserAsync(group.Key, ct);
            var (debit, credit) = LedgerTransaction.Create(pool.Id, account.Id, amount, $"{request.Kind}:{marketId}");
            entries.AddRange(new[] { debit, credit });
        }
        await ledger.AddRangeAsync(entries, ct);
        await receipts.AddAsync(SettlementReceipt.Create(marketId, hash, total), ct);
        await tx.CommitAsync(ct);
        return new(marketId, total);
    }
}
