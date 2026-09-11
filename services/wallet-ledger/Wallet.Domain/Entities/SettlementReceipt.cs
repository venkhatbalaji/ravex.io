namespace Wallet.Domain.Entities;

public class SettlementReceipt
{
    public Guid Id { get; private set; }
    public string PayloadHash { get; private set; } = "";
    public long Total { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    private SettlementReceipt() { }
    public static SettlementReceipt Create(Guid marketId, string hash, long total) =>
        new() { Id = marketId, PayloadHash = hash, Total = total, CreatedAt = DateTimeOffset.UtcNow };
}
