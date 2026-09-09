using MarketCatalog.Application.UseCases;
using MarketCatalog.Application.Abstractions;
using MarketCatalog.Infrastructure.Settlement;
using MarketCatalog.Domain.Repositories;
using MarketCatalog.Infrastructure.Persistence;
using MarketCatalog.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MarketCatalog.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddMarketCatalogInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["MARKET_CATALOG_DB_CONNECTION"]
            ?? "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=market_catalog";

        services.AddDbContext<MarketCatalogDbContext>(options => options.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "market_catalog")));

        services.AddScoped<IMarketRepository, MarketRepository>();
        services.AddSingleton<IStakeAdmission, HttpStakeAdmission>();

        services.AddScoped<IListMarketsUseCase, ListMarketsUseCase>();
        services.AddScoped<IGetMarketUseCase, GetMarketUseCase>();
        services.AddScoped<ICreateMarketUseCase, CreateMarketUseCase>();
        services.AddScoped<ILockMarketUseCase, LockMarketUseCase>();
        services.AddScoped<ISettleMarketUseCase, SettleMarketUseCase>();

        return services;
    }
}
