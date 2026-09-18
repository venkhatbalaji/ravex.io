using MarketCatalog.Domain.Entities;

namespace MarketCatalog.Domain.Repositories;

public interface IMarketRepository
{
    Task<IReadOnlyList<Market>> BrowseAsync(MarketQuery filter, CancellationToken ct = default);
    Task<IReadOnlyList<Market>> GetAllAsync(MarketStatus? status, CancellationToken ct = default);
    Task<Market?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Market market, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
