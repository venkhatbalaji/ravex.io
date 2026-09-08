using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MarketCatalog.Infrastructure.Persistence.Repositories;

public sealed class MarketRepository : IMarketRepository
{
    private readonly MarketCatalogDbContext _db;

    public MarketRepository(MarketCatalogDbContext db) => _db = db;

    public async Task<IReadOnlyList<Market>> GetAllAsync(MarketStatus? status, CancellationToken ct = default)
    {
        var query = _db.Markets.Include(m => m.Outcomes).AsQueryable();
        if (status is not null) query = query.Where(m => m.Status == status);
        return await query.OrderByDescending(m => m.EventStartAt).ToListAsync(ct);
    }

    public Task<Market?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.Markets.Include(m => m.Outcomes).SingleOrDefaultAsync(m => m.Id == id, ct);

    public async Task AddAsync(Market market, CancellationToken ct = default)
    {
        _db.Markets.Add(market);
        await _db.SaveChangesAsync(ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
