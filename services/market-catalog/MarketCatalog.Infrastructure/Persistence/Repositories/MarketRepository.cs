using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Exceptions;
using MarketCatalog.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MarketCatalog.Infrastructure.Persistence.Repositories;

public sealed class MarketRepository : IMarketRepository
{
    private readonly MarketCatalogDbContext _db;

    public MarketRepository(MarketCatalogDbContext db) => _db = db;

    public async Task<IReadOnlyList<Market>> BrowseAsync(MarketQuery filter, CancellationToken ct = default)
    {
        var query = _db.Markets.AsNoTracking().AsQueryable();
        if (filter.Status is not null) query = query.Where(m => m.Status == filter.Status);
        if (filter.CategoryId is not null) query = query.Where(m => m.CategoryId == filter.CategoryId);
        if (filter.Search is not null)
        {
            // Treat SQL wildcard characters as literal search text.
            var pattern = "%" + filter.Search.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
            query = query.Where(m => EF.Functions.ILike(m.Title, pattern, "\\") || EF.Functions.ILike(m.Description, pattern, "\\"));
        }
        query = filter.Phase switch
        {
            MarketPhase.Upcoming => query.Where(m => (m.Status == MarketStatus.Open || m.Status == MarketStatus.Locked) && m.EventStartAt > filter.ObservedAt),
            MarketPhase.Live => query.Where(m => (m.Status == MarketStatus.Open || m.Status == MarketStatus.Locked) && m.EventStartAt <= filter.ObservedAt),
            MarketPhase.Completed => query.Where(m => m.Status == MarketStatus.Settled || m.Status == MarketStatus.Cancelled),
            MarketPhase.Processing => query.Where(m => m.Status == MarketStatus.Settling || m.Status == MarketStatus.Refunding),
            _ => query
        };
        // Fetch one extra row to detect another page without a full count.
        return await query.OrderByDescending(m => m.EventStartAt).ThenBy(m => m.Id)
            .Skip(filter.Offset).Take(filter.Limit + 1).Include(m => m.Outcomes).ToListAsync(ct);
    }

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

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        try { await _db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new InvalidMarketStateException("Market changed concurrently; refresh and retry."); }
    }
}
