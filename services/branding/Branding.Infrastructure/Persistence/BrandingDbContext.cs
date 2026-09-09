using Branding.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Branding.Infrastructure.Persistence;

public sealed class BrandingDbContext : DbContext
{
    public BrandingDbContext(DbContextOptions<BrandingDbContext> options) : base(options) { }

    public DbSet<Theme> Themes => Set<Theme>();
    public DbSet<CopyOverride> CopyOverrides => Set<CopyOverride>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("branding");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BrandingDbContext).Assembly);
    }
}
