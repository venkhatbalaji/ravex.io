using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Wallet.Api.Endpoints;
using Wallet.Domain.Repositories;
using Wallet.Infrastructure;
using Wallet.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
Ravex.Configuration.ProductionConfiguration.Configure(builder, "WALLET_DB_CONNECTION", internalKey: true);
var serviceKey = builder.Configuration["INTERNAL_SERVICE_KEY"];
if (Ravex.Configuration.ProductionConfiguration.DatabaseMode(builder) != "migrate" && (string.IsNullOrWhiteSpace(serviceKey) || serviceKey.Length < 32))
    throw new InvalidOperationException("INTERNAL_SERVICE_KEY must contain at least 32 characters.");

builder.Services.AddWalletInfrastructure(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Ravex Wallet & Ledger API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT issued by the identity service. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"] ?? "dev-only-signing-key-change-me-please-32bytes!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = "ravex-identity",
            ValidAudience = "ravex-platform",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WalletDbContext>();
    await Ravex.Configuration.DatabaseStartup.InitializeAsync(db, builder, "wallet", async () =>
    {
        var accounts = scope.ServiceProvider.GetRequiredService<IAccountRepository>();
        await accounts.EnsureSystemAccountsSeededAsync();
    });
}

if (Ravex.Configuration.ProductionConfiguration.DatabaseMode(builder) == "migrate")
{
    await app.DisposeAsync();
    return;
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

// Liveness stays independent of dependencies; readiness checks this service's database.
app.MapGet("/health/ready", async (WalletDbContext db, HttpContext context) =>
{
    context.Response.Headers.CacheControl = "no-store";
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
    timeout.CancelAfter(TimeSpan.FromSeconds(2));
    var ready = false;
    try
    {
        // Use an independent connection so pooled sockets and EF retry policies
        // cannot hide a database outage or extend the probe indefinitely.
        var settings = new Npgsql.NpgsqlConnectionStringBuilder(db.Database.GetConnectionString())
        { Pooling = false, Timeout = 2, CommandTimeout = 2, CancellationTimeout = 1000 };
        await using var connection = new Npgsql.NpgsqlConnection(settings.ConnectionString);
        await connection.OpenAsync(timeout.Token);
        await using var probe = new Npgsql.NpgsqlCommand("SELECT 1", connection);
        await probe.ExecuteScalarAsync(timeout.Token);
        ready = true;
    }
    catch (Exception) { /* Return a minimal response; never expose connection details. */ }
    return Results.Json(new { status = ready ? "ready" : "not_ready", service = "wallet-ledger" }, statusCode: ready ? 200 : 503);
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "wallet-ledger" }));
app.MapWalletEndpoints();
app.MapInternalStakeEndpoints(serviceKey);

app.Run();
