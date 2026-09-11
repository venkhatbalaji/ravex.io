using Microsoft.EntityFrameworkCore;
using Wallet.Domain.Entities;
using Wallet.Domain.Repositories;
namespace Wallet.Infrastructure.Persistence.Repositories;
public sealed class SettlementReceiptRepository(WalletDbContext db) : ISettlementReceiptRepository
{
    public Task<SettlementReceipt?> GetAsync(Guid id, CancellationToken ct) => db.SettlementReceipts.SingleOrDefaultAsync(r => r.Id == id, ct);
    public async Task AddAsync(SettlementReceipt receipt, CancellationToken ct) { db.SettlementReceipts.Add(receipt); await db.SaveChangesAsync(ct); }
}
