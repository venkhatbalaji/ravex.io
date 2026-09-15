using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Gateway.Api;

public static class RequestLimits
{
    public static IServiceCollection AddRequestLimits(this IServiceCollection services, IConfiguration configuration)
    {
        int Read(string key, int fallback, int maximum)
        {
            var value = configuration.GetValue<int?>("RequestLimits:" + key) ?? fallback;
            if (value < 1 || value > maximum) throw new InvalidOperationException($"RequestLimits:{key} must be between 1 and {maximum}.");
            return value;
        }
        var window = TimeSpan.FromSeconds(Read("WindowSeconds", 60, 3600));
        var auth = Read("AuthPermits", 30, 100000);
        var earn = Read("EarnPermits", 10, 100000);
        var stakes = Read("StakePermits", 60, 100000);
        services.AddRateLimiter(options =>
        {
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                if (!HttpMethods.IsPost(context.Request.Method)) return RateLimitPartition.GetNoLimiter("other");
                string policy;
                int permits;
                if (context.Request.Path.StartsWithSegments("/auth", StringComparison.OrdinalIgnoreCase)) { policy = "auth"; permits = auth; }
                else if (context.Request.Path.StartsWithSegments("/wallet", StringComparison.OrdinalIgnoreCase)) { policy = "earn"; permits = earn; }
                else if (context.Request.Path.StartsWithSegments("/pools", StringComparison.OrdinalIgnoreCase)) { policy = "stakes"; permits = stakes; }
                else return RateLimitPartition.GetNoLimiter("other");

                // Authentication runs first. Never partition on an unvalidated
                // token, supplied user ID, or caller-controlled forwarding header.
                var ip = context.Connection.RemoteIpAddress;
                if (ip?.IsIPv4MappedToIPv6 == true) ip = ip.MapToIPv4();
                var identity = "ip:" + (ip?.ToString() ?? "unknown");
                if (policy != "auth" && context.User.Identity?.IsAuthenticated == true)
                {
                    var subject = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
                    if (!string.IsNullOrEmpty(subject)) identity = "user:" + subject;
                }
                return RateLimitPartition.GetFixedWindowLimiter(policy + ":" + identity, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permits, Window = window, QueueLimit = 0, AutoReplenishment = true
                });
            });
            options.OnRejected = async (context, ct) =>
            {
                var delay = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter) ? retryAfter : window;
                var seconds = Math.Max(1, (int)Math.Ceiling(delay.TotalSeconds));
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
                context.HttpContext.Response.Headers.CacheControl = "no-store";
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    error = "Too many requests. Wait before trying again. For a prediction retry, keep the same Idempotency-Key.",
                    retryAfterSeconds = seconds
                }, ct);
            };
        });
        return services;
    }
}
