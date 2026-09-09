using MarketCatalog.Domain.Entities;

namespace MarketCatalog.Domain.Repositories;

public interface ICategoryRepository
{
    Task<IReadOnlyList<Category>> GetAllAsync(CancellationToken ct = default);
    Task<Category?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Category category, CancellationToken ct = default);
    Task DeleteAsync(Category category, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
