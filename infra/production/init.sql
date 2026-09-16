-- Runs only on a new production database. No application gets the superuser
-- password or permission to access another service's schema.
REVOKE ALL ON DATABASE ravex FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $bootstrap$
DECLARE
    service text;
    role_name text;
    password text;
BEGIN
    FOREACH service IN ARRAY ARRAY['postgres','identity','wallet','market_catalog','settlement','branding'] LOOP
        role_name := 'ravex_' || service;
        password := rtrim(pg_read_file('/run/secrets/' || service || '_password'), E'\r\n');
        IF octet_length(password) < 32 OR btrim(password) = '' OR password ILIKE '%dev-only%' OR password ILIKE '%change-me%' OR password ILIKE '%integration-only%' THEN
            RAISE EXCEPTION 'Invalid service database password for %', service;
        END IF;
        IF service = 'postgres' THEN CONTINUE; END IF;
        EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', role_name, password);
        EXECUTE format('GRANT CONNECT ON DATABASE ravex TO %I', role_name);
        EXECUTE format('CREATE SCHEMA %I AUTHORIZATION %I', service, role_name);
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', service);
    END LOOP;
END;
$bootstrap$;
