"""Production migration/runtime separation checks using disposable PostgreSQL."""
import concurrent.futures

SERVICES = {
    'identity': ('identity', 'IDENTITY_DB_CONNECTION'),
    'wallet-ledger': ('wallet', 'WALLET_DB_CONNECTION'),
    'market-catalog': ('market_catalog', 'MARKET_CATALOG_DB_CONNECTION'),
    'settlement-engine': ('settlement', 'SETTLEMENT_DB_CONNECTION'),
    'branding': ('branding', 'BRANDING_DB_CONNECTION'),
}


def verify_migration_config(config):
    for service, (schema, _) in SERVICES.items():
        runtime = config['services'][service]
        job = config['services'][service + '-migrate']
        assert runtime['environment']['DATABASE_MODE'] == 'runtime'
        assert runtime['depends_on'][service + '-migrate']['condition'] == 'service_completed_successfully'
        assert job['environment']['DATABASE_MODE'] == 'migrate'
        assert job['restart'] == 'no' and set(job['depends_on']) == {'postgres'}
        assert runtime['build'] == job['build']
        runtime_secrets = {s['source'] for s in runtime['secrets']}
        job_secrets = {s['source'] for s in job['secrets']}
        assert not any('migrator' in s for s in runtime_secrets)
        assert 'admin_bootstrap_password' not in runtime_secrets
        assert job_secrets == {schema + '_migrator_connection'} | ({'admin_bootstrap_password'} if service == 'identity' else set())


def verify_unmigrated_startup(run):
    # Schemas exist, but their migration history and application tables do not.
    for service in SERVICES:
        result = run('run', '--rm', '--no-deps', service, check=False, timeout=60)
        assert result.returncode != 0 and 'migration' in result.stdout.lower(), service
    print('PASS: runtime startup fails closed before database migrations', flush=True)


def verify_migration_permissions(run, directory):
    def sql(statement, check=True):
        return run('exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'ravex', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement, check=check)

    def denied(role, statement):
        result = sql(f'SET ROLE {role}; {statement}', check=False)
        assert result.returncode != 0 and ('permission denied' in result.stdout or 'must be owner' in result.stdout), (role, statement)

    for service, (schema, key) in SERVICES.items():
        runtime = 'ravex_' + schema
        migrator = runtime + '_migrator'
        history = 'schema_migrations' if schema == 'settlement' else '__ef_migrations_history'
        assert run('ps', '--all', '--format', '{{.State}} {{.ExitCode}}', service + '-migrate').stdout.strip() == 'exited 0'
        assert sql(f"SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='{schema}'").stdout.strip() == migrator
        assert sql(f"SELECT pg_has_role('{runtime}','{migrator}','MEMBER')").stdout.strip() == 'f'
        for role in (runtime, migrator):
            assert sql(f"SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls FROM pg_roles WHERE rolname='{role}'").stdout.strip() == 'f'
            other = 'wallet' if schema == 'identity' else 'identity'
            denied(role, f'CREATE TABLE {other}.forbidden_probe(id integer)')
            assert sql(f"SELECT has_schema_privilege('{role}','{other}','USAGE')").stdout.strip() == 'f'
        assert sql(f"SELECT has_table_privilege('{runtime}','{schema}.{history}','SELECT')").stdout.strip() == 't'
        for privilege in ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']:
            assert sql(f"SELECT has_table_privilege('{runtime}','{schema}.{history}','{privilege}')").stdout.strip() == 'f'
        denied(runtime, f'DELETE FROM {schema}.{history} WHERE false')
        denied(runtime, f'CREATE TABLE {schema}.forbidden_probe(id integer)')
        denied(runtime, 'CREATE SCHEMA forbidden_probe')

        # New objects inherit runtime DML/sequence grants from the migration role.
        sql(f'SET ROLE {migrator}; CREATE TABLE {schema}.permission_probe(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, value integer NOT NULL DEFAULT 0)')
        sql(f'SET ROLE {runtime}; INSERT INTO {schema}.permission_probe DEFAULT VALUES; UPDATE {schema}.permission_probe SET value=1; SELECT * FROM {schema}.permission_probe; DELETE FROM {schema}.permission_probe')
        denied(runtime, f'ALTER TABLE {schema}.permission_probe ADD COLUMN forbidden integer')
        denied(runtime, f'DROP TABLE {schema}.permission_probe')
        denied(runtime, f'TRUNCATE {schema}.permission_probe')
        denied(runtime, f'CREATE INDEX forbidden_probe ON {schema}.permission_probe(value)')
        sql(f'SET ROLE {migrator}; DROP TABLE {schema}.permission_probe')

        # Strong credentials alone must not let schema owners serve requests.
        result = run('run', '--rm', '--no-deps', '-v', f'{directory}/{schema}_migrator_connection:/run/secrets/elevated_connection:ro',
                     '-e', key + '_FILE=/run/secrets/elevated_connection', service, check=False, timeout=60)
        assert result.returncode != 0 and 'must not own schema objects' in result.stdout, service
        result = run('run', '--rm', '--no-deps', '-e', 'DATABASE_MODE=migrate', service, check=False, timeout=60)
        assert result.returncode != 0 and 'must own its service schema' in result.stdout, service
        for mode in ('auto', 'invalid'):
            result = run('run', '--rm', '--no-deps', '-e', 'DATABASE_MODE=' + mode, service, check=False, timeout=60)
            assert result.returncode != 0 and 'DATABASE_MODE' in result.stdout, service

    before = {schema: sql(f'SELECT count(*) FROM {schema}.' + ('schema_migrations' if schema == 'settlement' else '__ef_migrations_history')).stdout.strip()
              for schema, _ in SERVICES.values()}
    for service in SERVICES:
        run('run', '--rm', '--no-deps', service + '-migrate')
    # Both migration engines must serialize concurrent invocations, including seeds.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        results = [executor.submit(run, 'run', '--rm', '--no-deps', service + '-migrate')
                   for service in ['identity', 'identity', 'settlement-engine', 'settlement-engine']]
        for result in results:
            result.result()
    after = {schema: sql(f'SELECT count(*) FROM {schema}.' + ('schema_migrations' if schema == 'settlement' else '__ef_migrations_history')).stdout.strip()
             for schema, _ in SERVICES.values()}
    assert before == after
    assert sql('SELECT count(*) FROM identity.users WHERE "Role"=\'Admin\'').stdout.strip() == '1'
    print('PASS: runtime DML, denied DDL/history writes, schema ownership, isolated secrets, migration reruns and concurrent jobs', flush=True)


def verify_failed_migration_gate(run, temporary):
    override = temporary / 'failed-migration.yml'
    override.write_text('services:\n  wallet-ledger-migrate:\n    environment:\n      DATABASE_MODE: invalid\n')
    run('stop', 'wallet-ledger')
    result = run('up', '-d', '--no-build', 'wallet-ledger', files=[override], check=False)
    assert result.returncode != 0
    assert run('ps', '--all', '--format', '{{.State}}', 'wallet-ledger').stdout.strip() != 'running'
    run('up', '-d', '--no-build', 'wallet-ledger')
    print('PASS: a failed migration job blocks runtime startup and can be retried', flush=True)
