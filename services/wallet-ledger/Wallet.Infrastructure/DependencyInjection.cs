using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wallet.Application.Abstractions;
using Wallet.Application.UseCases;
using Wallet.Domain.Repositories;
using Wallet.Infrastructure.Configuration;
using Wallet.Infrastructure.Persistence;
using Wallet.Infrastructure.Persistence.Repositories;

namespace Wallet.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddWalletInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["WALLET_DB_CONNECTION"]
            ?? "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=wallet";

        services.AddDbContext<WalletDbContext>(options => options.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "wallet")));

        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<ILedgerRepository, LedgerRepository>();
        services.AddScoped<IStakeDebitRepository, StakeDebitRepository>();
        services.AddScoped<IWalletTransaction, WalletTransaction>();
        services.AddSingleton<IEarnRateCatalog, StaticEarnRateCatalog>();

        services.AddScoped<IEarnCoinsUseCase, EarnCoinsUseCase>();
        services.AddScoped<IGetBalanceUseCase, GetBalanceUseCase>();
        services.AddScoped<IGetLedgerUseCase, GetLedgerUseCase>();
        services.AddScoped<IPlaceStakeUseCase, PlaceStakeUseCase>();

        return services;
    }
}
