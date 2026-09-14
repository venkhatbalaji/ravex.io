using System.Text;
using Branding.Api.Endpoints;
using Branding.Domain.Repositories;
using Branding.Infrastructure;
using Branding.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBrandingInfrastructure(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Ravex Branding API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT from POST /auth/login. Example: \"Bearer {token}\"",
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

var signingKey = builder.Configuration["JWT_SIGNING_KEY"] ?? "dev-only-signing-key-change-me-please-32bytes!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = "ravex-identity",
            ValidAudience = "ravex-platform",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("admin", policy => policy.RequireRole("Admin"));
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BrandingDbContext>();
    db.Database.Migrate();

    var themes = scope.ServiceProvider.GetRequiredService<IThemeRepository>();
    await themes.EnsureSeededAsync();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

// Liveness stays independent of dependencies; readiness checks this service's database.
app.MapGet("/health/ready", async (BrandingDbContext db, HttpContext context) =>
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
    return Results.Json(new { status = ready ? "ready" : "not_ready", service = "branding" }, statusCode: ready ? 200 : 503);
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "branding" }));
app.MapThemeEndpoints();
app.MapCopyEndpoints();

app.Run();
