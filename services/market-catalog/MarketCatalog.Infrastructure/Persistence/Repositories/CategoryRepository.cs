using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MarketCatalog.Infrastructure.Persistence.Repositories;

public sealed class CategoryRepository : ICategoryRepository
{
    private readonly MarketCatalogDbContext _db;

    public CategoryRepository(MarketCatalogDbContext db) => _db = db;

    public async Task<IReadOnlyList<Category>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Categories.OrderBy(c => c.Name).ToListAsync(ct);

    public Task<Category?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.Categories.SingleOrDefaultAsync(c => c.Id == id, ct);

    public Task<bool> ExistsAsync(Guid id, CancellationToken ct = default) =>
        _db.Categories.AnyAsync(c => c.Id == id, ct);

    public async Task AddAsync(Category category, CancellationToken ct = default)
    {
        _db.Categories.Add(category);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Category category, CancellationToken ct = default)
    {
        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
