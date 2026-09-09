using Branding.Domain.Entities;
using Branding.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Branding.Infrastructure.Persistence.Repositories;

public sealed class ThemeRepository : IThemeRepository
{
    private readonly BrandingDbContext _db;

    public ThemeRepository(BrandingDbContext db) => _db = db;

    public Task<Theme> GetAsync(CancellationToken ct = default) =>
        _db.Themes.SingleAsync(t => t.Id == Theme.SingletonId, ct);

    public async Task EnsureSeededAsync(CancellationToken ct = default)
    {
        if (await _db.Themes.AnyAsync(t => t.Id == Theme.SingletonId, ct)) return;

        _db.Themes.Add(Theme.CreateDefault());
        await _db.SaveChangesAsync(ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
