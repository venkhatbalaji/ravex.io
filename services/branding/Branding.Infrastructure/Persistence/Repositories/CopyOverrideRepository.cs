using Branding.Domain.Entities;
using Branding.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Branding.Infrastructure.Persistence.Repositories;

public sealed class CopyOverrideRepository : ICopyOverrideRepository
{
    private readonly BrandingDbContext _db;

    public CopyOverrideRepository(BrandingDbContext db) => _db = db;

    public async Task<IReadOnlyList<CopyOverride>> GetAllAsync(CancellationToken ct = default) =>
        await _db.CopyOverrides.OrderBy(c => c.Key).ToListAsync(ct);

    public Task<CopyOverride?> GetByKeyAsync(string key, CancellationToken ct = default) =>
        _db.CopyOverrides.SingleOrDefaultAsync(c => c.Key == key, ct);

    public async Task AddAsync(CopyOverride entry, CancellationToken ct = default)
    {
        _db.CopyOverrides.Add(entry);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(CopyOverride entry, CancellationToken ct = default)
    {
        _db.CopyOverrides.Remove(entry);
        await _db.SaveChangesAsync(ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
