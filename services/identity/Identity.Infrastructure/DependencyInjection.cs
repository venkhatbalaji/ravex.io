using Identity.Application.Abstractions;
using Identity.Application.UseCases;
using Identity.Domain.Repositories;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Persistence.Repositories;
using Identity.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Identity.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddIdentityInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["IDENTITY_DB_CONNECTION"]
            ?? "Host=localhost;Port=5432;Database=ravex;Username=ravex;Password=ravex_dev;Search Path=identity";
        var signingKey = configuration["JWT_SIGNING_KEY"]
            ?? "dev-only-signing-key-change-me-please-32bytes!";

        services.AddDbContext<IdentityDbContext>(options => options.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "identity")));
        services.AddSingleton(new JwtOptions { SigningKey = signingKey });

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<ITokenIssuer, JwtTokenIssuer>();

        services.AddScoped<IRegisterUserUseCase, RegisterUserUseCase>();
        services.AddScoped<ILoginUseCase, LoginUseCase>();

        return services;
    }
}
