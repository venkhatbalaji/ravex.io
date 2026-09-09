using Branding.Domain.Entities;

namespace Branding.Domain.Repositories;

public interface ICopyOverrideRepository
{
    Task<IReadOnlyList<CopyOverride>> GetAllAsync(CancellationToken ct = default);
    Task<CopyOverride?> GetByKeyAsync(string key, CancellationToken ct = default);
    Task AddAsync(CopyOverride entry, CancellationToken ct = default);
    Task DeleteAsync(CopyOverride entry, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
