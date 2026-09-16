using System.Text;
using Gateway.Api;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
Ravex.Configuration.ProductionConfiguration.Configure(builder);

var platformOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3001", "http://localhost:3002" };
builder.Services.AddCors(options => options.AddPolicy("platform", policy => policy
    .WithOrigins(platformOrigins)
    // PUT/DELETE are here for apps/admin (theme, copy, and category updates) —
    // apps/platform itself only ever sends GET/POST.
    .WithMethods("GET", "POST", "PUT", "DELETE")
    .WithHeaders("Content-Type", "Authorization", "Idempotency-Key")
    .WithExposedHeaders("Retry-After")));

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
// remain public. Request quotas below are an additional gateway control;
// owning services still enforce their authorization and ledger invariants.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("authenticated", policy => policy.RequireAuthenticatedUser());
    options.AddPolicy("admin", policy => policy.RequireRole("Admin"));
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddHttpClient("readiness", client => client.Timeout = TimeSpan.FromSeconds(4));

builder.Services.AddRequestLimits(builder.Configuration);

var app = builder.Build();

app.UseCors("platform");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Every configured cluster needs at least one ready destination. Probes run
// concurrently; a downstream outage must not make gateway liveness fail.
app.MapGet("/health/ready", async (IHttpClientFactory clients, IConfiguration configuration, HttpContext context) =>
{
    context.Response.Headers.CacheControl = "no-store";
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
    timeout.CancelAfter(TimeSpan.FromSeconds(5));
    var client = clients.CreateClient("readiness");
    async Task<bool> Probe(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return false;
        try
        {
            using var response = await client.GetAsync(address.TrimEnd('/') + "/health/ready", timeout.Token);
            return response.IsSuccessStatusCode;
        }
        catch (Exception) { return false; }
    }
    var clusters = configuration.GetSection("ReverseProxy:Clusters").GetChildren().ToArray();
    var checks = await Task.WhenAll(clusters.Select(async cluster =>
    {
        var destinations = await Task.WhenAll(cluster.GetSection("Destinations").GetChildren().Select(d => Probe(d["Address"])));
        return destinations.Any(ready => ready);
    }));
    var ready = checks.Length > 0 && checks.All(value => value);
    return Results.Json(new { status = ready ? "ready" : "not_ready", service = "gateway" }, statusCode: ready ? 200 : 503);
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "gateway" }));
app.MapReverseProxy();

app.Run();
