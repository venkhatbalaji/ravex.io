using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var platformOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3001", "http://localhost:3002" };
builder.Services.AddCors(options => options.AddPolicy("platform", policy => policy
    .WithOrigins(platformOrigins)
    // PUT/DELETE are here for apps/admin (theme, copy, and category updates) —
    // apps/platform itself only ever sends GET/POST.
    .WithMethods("GET", "POST", "PUT", "DELETE")
    .WithHeaders("Content-Type", "Authorization", "Idempotency-Key")));

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

// A route only ends up gated by this when its appsettings.json entry sets
// "AuthorizationPolicy": "authenticated" or "admin" — routes without one
// stay exactly as open as the backend service they proxy to; the gateway
// never gets stricter than the service behind it on its own.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("authenticated", policy => policy.RequireAuthenticatedUser());
    options.AddPolicy("admin", policy => policy.RequireRole("Admin"));
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.UseCors("platform");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "gateway" }));
app.MapReverseProxy();

app.Run();
