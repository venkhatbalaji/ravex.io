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
var serviceKey = builder.Configuration["INTERNAL_SERVICE_KEY"];
if (string.IsNullOrWhiteSpace(serviceKey) || serviceKey.Length < 32)
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
    db.Database.Migrate();

    var accounts = scope.ServiceProvider.GetRequiredService<IAccountRepository>();
    await accounts.EnsureSystemAccountsSeededAsync();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "wallet-ledger" }));
app.MapWalletEndpoints();
app.MapInternalStakeEndpoints(serviceKey);

app.Run();
