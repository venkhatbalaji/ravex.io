using MarketCatalog.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MarketCatalog.Infrastructure.Persistence;

public sealed class MarketCatalogDbContext : DbContext
{
    public MarketCatalogDbContext(DbContextOptions<MarketCatalogDbContext> options) : base(options) { }

    public DbSet<Market> Markets => Set<Market>();
    public DbSet<Outcome> Outcomes => Set<Outcome>();
    public DbSet<Category> Categories => Set<Category>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("market_catalog");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MarketCatalogDbContext).Assembly);
    }
}
