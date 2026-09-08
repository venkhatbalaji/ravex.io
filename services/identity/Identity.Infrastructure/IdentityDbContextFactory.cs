using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Identity.Infrastructure;

/// <summary>Lets `dotnet ef migrations add` build the model without starting the app or touching a live database.</summary>
public sealed class IdentityDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<IdentityDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=identity",
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "identity"));
        return new IdentityDbContext(optionsBuilder.Options);
    }
}
