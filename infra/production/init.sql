-- New production volumes only. Migration roles own schemas and objects;
-- runtime roles receive DML, never ownership or membership in migration roles.
REVOKE ALL ON DATABASE ravex FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $bootstrap$
DECLARE
    service text;
    role_name text;
    migration_role text;
    suffix text;
    password text;
    passwords text[] := ARRAY[]::text[];
BEGIN
    password := rtrim(pg_read_file('/run/secrets/postgres_password'), E'\r\n');
    IF octet_length(password) < 32 OR btrim(password) = '' OR password ILIKE '%dev-only%' OR password ILIKE '%change-me%' OR password ILIKE '%integration-only%' THEN
        RAISE EXCEPTION 'Invalid PostgreSQL administrator password';
    END IF;
    passwords := array_append(passwords, password);
    FOREACH service IN ARRAY ARRAY['identity','wallet','market_catalog','settlement','branding'] LOOP
        role_name := 'ravex_' || service;
        migration_role := role_name || '_migrator';
        FOREACH suffix IN ARRAY ARRAY['', '_migrator'] LOOP
            password := rtrim(pg_read_file('/run/secrets/' || service || suffix || '_password'), E'\r\n');
            IF octet_length(password) < 32 OR btrim(password) = '' OR password ILIKE '%dev-only%' OR password ILIKE '%change-me%' OR password ILIKE '%integration-only%' THEN
                RAISE EXCEPTION 'Invalid database password for %', service || suffix;
            END IF;
            IF password = ANY(passwords) THEN
                RAISE EXCEPTION 'Database principals must use distinct passwords';
            END IF;
            passwords := array_append(passwords, password);
            EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', role_name || suffix, password);
            EXECUTE format('GRANT CONNECT ON DATABASE ravex TO %I', role_name || suffix);
        END LOOP;
        EXECUTE format('CREATE SCHEMA %I AUTHORIZATION %I', service, migration_role);
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', service);
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', service, role_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', migration_role, service, role_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I', migration_role, service, role_name);
        -- Future functions must receive explicit grants instead of public execution.
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', migration_role);
    END LOOP;
END;
$bootstrap$;
