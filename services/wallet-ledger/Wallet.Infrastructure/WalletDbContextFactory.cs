using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Wallet.Infrastructure.Persistence;

namespace Wallet.Infrastructure;

/// <summary>Lets `dotnet ef migrations add` build the model without starting the app or touching a live database.</summary>
public sealed class WalletDbContextFactory : IDesignTimeDbContextFactory<WalletDbContext>
{
    public WalletDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<WalletDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=wallet",
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "wallet"));
        return new WalletDbContext(optionsBuilder.Options);
    }
}
