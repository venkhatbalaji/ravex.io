using Branding.Application.UseCases;
using Branding.Domain.Repositories;
using Branding.Infrastructure.Persistence;
using Branding.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Branding.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddBrandingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["BRANDING_DB_CONNECTION"]
            ?? "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=branding";

        services.AddDbContext<BrandingDbContext>(options => options.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "branding")));

        services.AddScoped<IThemeRepository, ThemeRepository>();
        services.AddScoped<ICopyOverrideRepository, CopyOverrideRepository>();

        services.AddScoped<IGetThemeUseCase, GetThemeUseCase>();
        services.AddScoped<IUpdateThemeUseCase, UpdateThemeUseCase>();
        services.AddScoped<IGetCopyOverridesUseCase, GetCopyOverridesUseCase>();
        services.AddScoped<IUpsertCopyOverrideUseCase, UpsertCopyOverrideUseCase>();
        services.AddScoped<IDeleteCopyOverrideUseCase, DeleteCopyOverrideUseCase>();

        return services;
    }
}
