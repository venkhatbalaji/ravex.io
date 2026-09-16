using System.Data.Common;
using System.Diagnostics.CodeAnalysis;
using System.Text;

namespace Ravex.Configuration;

// Linked into API hosts only: configuration must be checked before migrations,
// bootstrap, dependency construction, or binding HTTP ports.
public static class ProductionConfiguration
{
    public static void Configure(WebApplicationBuilder builder, string? databaseKey = null, bool internalKey = false, bool bootstrap = false)
    {
        var keys = new List<string> { "JWT_SIGNING_KEY" };
        if (databaseKey is not null) keys.Add(databaseKey);
        if (internalKey) keys.Add("INTERNAL_SERVICE_KEY");
        if (bootstrap) keys.Add("ADMIN_BOOTSTRAP_PASSWORD");
        foreach (var key in keys)
        {
            var file = builder.Configuration[key + "_FILE"];
            if (string.IsNullOrWhiteSpace(file)) continue;
            if (!string.IsNullOrEmpty(builder.Configuration[key])) Fail(key, "cannot be set together with its _FILE option");
            string value;
            try { value = File.ReadAllText(file).TrimEnd('\r', '\n'); }
            catch { throw new InvalidOperationException($"Cannot read {key}_FILE."); }
            builder.Configuration[key] = value;
        }
        if (builder.Environment.IsDevelopment()) return;
        RequireSecret("JWT_SIGNING_KEY", builder.Configuration["JWT_SIGNING_KEY"]);
        if (internalKey)
        {
            RequireSecret("INTERNAL_SERVICE_KEY", builder.Configuration["INTERNAL_SERVICE_KEY"]);
            if (builder.Configuration["INTERNAL_SERVICE_KEY"] == builder.Configuration["JWT_SIGNING_KEY"])
                Fail("INTERNAL_SERVICE_KEY", "must differ from JWT_SIGNING_KEY");
        }
        if (databaseKey is not null)
        {
            var raw = builder.Configuration[databaseKey];
            if (string.IsNullOrWhiteSpace(raw)) Fail(databaseKey, "is required outside Development");
            var connection = new DbConnectionStringBuilder();
            try { connection.ConnectionString = raw; }
            catch { throw new InvalidOperationException($"{databaseKey} is malformed."); }
            foreach (string name in connection.Keys)
                if (new[] { "User ID", "UserId", "User Name", "User", "UID", "PWD" }.Contains(name, StringComparer.OrdinalIgnoreCase))
                    Fail(databaseKey, "must use canonical Username and Password keys without credential aliases");
            var password = connection.TryGetValue("Password", out var p) ? p?.ToString() : null;
            RequireSecret(databaseKey + " password", password);
            var user = connection.TryGetValue("Username", out var u) ? u?.ToString() : null;
            if (string.IsNullOrWhiteSpace(user) || user is "postgres" or "ravex")
                Fail(databaseKey, "requires an explicit service database user");
        }
        if (bootstrap)
        {
            var email = builder.Configuration["ADMIN_BOOTSTRAP_EMAIL"];
            var password = builder.Configuration["ADMIN_BOOTSTRAP_PASSWORD"];
            if (!string.IsNullOrEmpty(email) || !string.IsNullOrEmpty(password))
            {
                if (string.IsNullOrWhiteSpace(email) || email.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
                    Fail("ADMIN_BOOTSTRAP_EMAIL", "requires an explicit non-development address");
                RequireSecret("ADMIN_BOOTSTRAP_PASSWORD", password);
            }
        }
    }
    private static void RequireSecret(string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || Encoding.UTF8.GetByteCount(value) < 32 ||
            value.Contains("dev-only", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("integration-only", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("change-me", StringComparison.OrdinalIgnoreCase))
            Fail(key, "requires at least 32 bytes and must not use development/test placeholders");
    }
    [DoesNotReturn]
    private static void Fail(string key, string message) => throw new InvalidOperationException($"{key} {message}.");
}
