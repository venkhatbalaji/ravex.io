using Branding.Domain.Entities;

namespace Branding.Domain.Repositories;

public interface IThemeRepository
{
    Task<Theme> GetAsync(CancellationToken ct = default);
    Task EnsureSeededAsync(CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
