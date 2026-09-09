using Microsoft.EntityFrameworkCore;
using Wallet.Domain.Entities;
using Wallet.Domain.Repositories;

namespace Wallet.Infrastructure.Persistence.Repositories;

public sealed class AccountRepository : IAccountRepository
{
    private readonly WalletDbContext _db;

    public AccountRepository(WalletDbContext db) => _db = db;

    public async Task<Account> GetOrCreateForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var account = await _db.Accounts.SingleOrDefaultAsync(a => a.OwnerUserId == userId, ct);
        if (account is not null) return account;

        account = Account.ForUser(userId);
        // Reads may lazily create the same account concurrently with a mutation.
        await _db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO wallet.accounts ("Id", "OwnerType", "OwnerUserId", "CreatedAt")
            VALUES ({account.Id}, {"User"}, {userId}, {account.CreatedAt})
            ON CONFLICT ("OwnerUserId") DO NOTHING
            """, ct);
        return await _db.Accounts.SingleAsync(a => a.OwnerUserId == userId, ct);
    }

    public Task<Account> GetHouseAccountAsync(CancellationToken ct = default) =>
        _db.Accounts.SingleAsync(a => a.Id == Account.HouseAccountId, ct);

    public Task<Account> GetPoolAccountAsync(CancellationToken ct = default) =>
        _db.Accounts.SingleAsync(a => a.Id == Account.PoolAccountId, ct);

    public async Task EnsureSystemAccountsSeededAsync(CancellationToken ct = default)
    {
        if (!await _db.Accounts.AnyAsync(a => a.Id == Account.HouseAccountId, ct))
            _db.Accounts.Add(Account.House());

        if (!await _db.Accounts.AnyAsync(a => a.Id == Account.PoolAccountId, ct))
            _db.Accounts.Add(Account.Pool());

        await _db.SaveChangesAsync(ct);
    }
}
