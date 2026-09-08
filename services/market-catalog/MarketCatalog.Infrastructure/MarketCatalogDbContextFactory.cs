using MarketCatalog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MarketCatalog.Infrastructure;

/// <summary>Lets `dotnet ef migrations add` build the model without starting the app or touching a live database.</summary>
public sealed class MarketCatalogDbContextFactory : IDesignTimeDbContextFactory<MarketCatalogDbContext>
{
    public MarketCatalogDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<MarketCatalogDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=market_catalog",
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "market_catalog"));
        return new MarketCatalogDbContext(optionsBuilder.Options);
    }
}
