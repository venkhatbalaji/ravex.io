using Microsoft.EntityFrameworkCore;

namespace Ravex.Configuration;

// Linked only into database-owning hosts. Runtime startup never executes DDL.
public static class DatabaseStartup
{
    public static async Task InitializeAsync(DbContext db, WebApplicationBuilder builder, string schema, Func<Task>? seed = null)
    {
        if (schema is not ("identity" or "wallet" or "market_catalog" or "branding"))
            throw new ArgumentException("Unknown service schema.", nameof(schema));
        var mode = ProductionConfiguration.DatabaseMode(builder);
        await db.Database.OpenConnectionAsync();
        try
        {
            if (mode == "runtime")
            {
                if (!builder.Environment.IsDevelopment())
                {
                    await using var check = db.Database.GetDbConnection().CreateCommand();
                    check.CommandText = $"""
                        SELECT has_schema_privilege(current_user, '{schema}', 'CREATE')
                            OR has_database_privilege(current_user, current_database(), 'CREATE')
                            OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = '{schema}' AND pg_has_role(current_user, nspowner, 'MEMBER'))
                            OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                                WHERE n.nspname = '{schema}' AND pg_has_role(current_user, c.relowner, 'MEMBER'))
                        """;
                    if (await check.ExecuteScalarAsync() is true)
                        throw new InvalidOperationException("Runtime database role must not own schema objects or have migration privileges.");
                }
                if ((await db.Database.GetPendingMigrationsAsync()).Any())
                    throw new InvalidOperationException("Pending database migrations: run the migration job before starting this service.");
                return;
            }

            if (!builder.Environment.IsDevelopment())
            {
                await using var check = db.Database.GetDbConnection().CreateCommand();
                check.CommandText = $"SELECT pg_get_userbyid(nspowner)=current_user FROM pg_namespace WHERE nspname='{schema}'";
                if (await check.ExecuteScalarAsync() is not true)
                    throw new InvalidOperationException("Migration database role must own its service schema.");
            }
            // EF8 does not serialize concurrent migration processes. Keep the
            // connection open so this session lock also covers idempotent seeds.
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_lock(hashtextextended({schema + ":migrations"}, 0))");
            try
            {
                await db.Database.MigrateAsync();
                if (!builder.Environment.IsDevelopment())
                {
                    // Default DML grants apply to newly created tables, including
                    // EF's history table. Runtime may inspect but never edit it.
                    await db.Database.ExecuteSqlRawAsync($"REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON {schema}.__ef_migrations_history FROM ravex_{schema}");
                }
                if (seed is not null) await seed();
            }
            finally
            {
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_unlock(hashtextextended({schema + ":migrations"}, 0))");
            }
        }
        finally { await db.Database.CloseConnectionAsync(); }
    }
}
