using Branding.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Branding.Infrastructure;

/// <summary>Lets `dotnet ef migrations add` build the model without starting the app or touching a live database.</summary>
public sealed class BrandingDbContextFactory : IDesignTimeDbContextFactory<BrandingDbContext>
{
    public BrandingDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<BrandingDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=branding",
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "branding"));
        return new BrandingDbContext(optionsBuilder.Options);
    }
}
