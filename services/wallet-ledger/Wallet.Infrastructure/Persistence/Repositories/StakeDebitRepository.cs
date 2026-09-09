using Microsoft.EntityFrameworkCore;
using Wallet.Domain.Entities;
using Wallet.Domain.Repositories;

namespace Wallet.Infrastructure.Persistence.Repositories;

public sealed class StakeDebitRepository(WalletDbContext db) : IStakeDebitRepository
{
    public Task<StakeDebit?> GetAsync(Guid id, CancellationToken ct) =>
        db.StakeDebits.SingleOrDefaultAsync(d => d.Id == id, ct);

    public async Task AddAsync(StakeDebit debit, CancellationToken ct)
    {
        db.StakeDebits.Add(debit);
        await db.SaveChangesAsync(ct);
    }
}
