using System.Text;
using Identity.Api.Endpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Entities;
using Identity.Domain.Repositories;
using Identity.Infrastructure;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddIdentityInfrastructure(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Ravex Identity API", Version = "v1" });
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
            ValidIssuer = JwtOptions.Issuer,
            ValidAudience = JwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
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
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    db.Database.Migrate();

    // The only way an Admin account is ever created — public /auth/register
    // always issues Player accounts. Set both env vars to seed the first
    // admin; idempotent, safe to leave set across restarts.
    var bootstrapEmail = builder.Configuration["ADMIN_BOOTSTRAP_EMAIL"];
    var bootstrapPassword = builder.Configuration["ADMIN_BOOTSTRAP_PASSWORD"];
    if (!string.IsNullOrWhiteSpace(bootstrapEmail) && !string.IsNullOrWhiteSpace(bootstrapPassword))
    {
        var users = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var email = bootstrapEmail.Trim().ToLowerInvariant();
        if (!await users.ExistsByEmailAsync(email))
        {
            var admin = User.RegisterAdmin(email, "Admin", hasher.Hash(bootstrapPassword));
            await users.AddAsync(admin);
        }
    }
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "identity" }));
app.MapAuthEndpoints();

app.Run();
