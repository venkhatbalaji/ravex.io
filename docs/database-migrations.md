# Production database migration jobs

The production baseline separates runtime database access from schema ownership
for Identity, Wallet, Catalog, Settlement and Branding. These guarantees apply
to a **new production database initialized by the current configuration**.
Existing volumes require an explicit ownership/credential migration before
upgrading; changing the Compose file does not change their grants.

## Principals and credentials

For each service schema, `ravex_<schema>_migrator` owns the schema and the objects
created by its migration job. `ravex_<schema>` is the runtime login. Both can
connect to the database, but neither has superuser, database creation, role
creation, replication or row-security bypass privileges. Neither can access
another service's schema. Runtime roles are not members of migration roles.

Runtime has schema usage, table SELECT/INSERT/UPDATE/DELETE and sequence
USAGE/SELECT. It cannot create, alter, drop or truncate tables, create indexes,
or grant itself ownership. Migration history tables are SELECT-only for
runtime. The initializer sets default privileges for objects created by each
migration principal; migration jobs remove history-table mutation privileges
before completing. New functions have no default public execution grant.

The secret generator creates distinct passwords and connection files for all
ten service logins, plus the PostgreSQL administrator. The initializer rejects
reused passwords. Runtime containers mount only runtime connection files.
Migration jobs mount their own migration connection file; Identity's job also
mounts the initial administrator password. Jobs receive no JWT signing key or
internal service key. PostgreSQL's bootstrap mounts the password files, not the
application connection files.

These table-level grants do not replace application authorization or ledger
invariants: a runtime login can still modify data in its service's schema.
Further restrictions such as per-table append-only ledger enforcement remain
separate work.

## Startup modes

All five database-owning hosts use `DATABASE_MODE`:

| Mode | Behavior |
| --- | --- |
| `runtime` | Default outside Development. Verify runtime privileges and applied migrations, then start HTTP/workers. No migration or seed writes at startup. |
| `migrate` | Apply migrations, restrict history-table grants, seed initial data, and exit without starting HTTP/workers. Production requires the schema-owning principal. |
| `auto` | Default only in Development. Apply migrations and seed data, then start the host. Rejected in other environments. |

Unknown modes fail startup. Production runtime rejects schema/object owners,
accounts with ownership-role membership, or accounts with schema/database CREATE
privileges. It also fails when the binary's required migrations are missing.
This prevents an old production schema-owner connection file being silently used
as the new runtime connection.

.NET jobs take a PostgreSQL session advisory lock covering migrations and seeds.
Settlement takes a transaction advisory lock and applies its embedded migrations
and history grants in the same transaction. Repeated successful jobs are no-ops
for existing migration versions and seeds; concurrent invocations serialize.
These locks coordinate this repository's migration runners, not arbitrary DBA
commands or external migration tools.

## Deployment

For a fresh installation, follow [production setup](production-deployment.md).
`docker compose -f compose.production.yml up -d --build` runs the five
`*-migrate` jobs after PostgreSQL is healthy. Each runtime depends on its own job
with `condition: service_completed_successfully`. A failed job blocks that
runtime's startup. Other services may start; Gateway readiness remains unhealthy
until all required services are available. This gate does not stop an already
running instance when a later migration attempt fails.

For a subsequent release on an installation already using these roles, build
the release images and run migrations explicitly. With the documented production
environment variables set and PostgreSQL running:

```sh
docker compose -f compose.production.yml build
for job in identity-migrate wallet-ledger-migrate market-catalog-migrate settlement-engine-migrate branding-migrate; do
  docker compose -f compose.production.yml run --rm --no-deps "$job" || exit 1
done
docker compose -f compose.production.yml up -d
```

Review migrations, take a restorable backup and select a maintenance or compatible
rolling-release procedure before applying a release. This sequence is not an
atomic rollout across services. A failed job can leave earlier EF migrations
committed; diagnose it and roll forward with a reviewed correction. Do not delete
migration history or automatically run down-migrations against live coin data.

After initial administrator provisioning, remove `ADMIN_BOOTSTRAP_EMAIL`,
`ADMIN_BOOTSTRAP_PASSWORD_FILE` and the bootstrap secret mount from
`identity-migrate`. Runtime Identity never receives the bootstrap password or
creates administrators at startup in production.

## Existing volumes

The PostgreSQL initializer runs only once. Existing installations using the old
schema-owning `ravex_<schema>` logins will fail the new runtime privilege check.
Do not delete their volumes or regenerate/replace their current passwords to
force initialization.

Use a database-owner-controlled upgrade with an inventory and a tested backup:

1. Create independent migration credentials and schema-confined migration roles.
   Keep existing runtime credentials and application records intact.
2. Transfer each service schema and its tables/sequences to its migration role.
   Inventory ownership first; do not blindly reassign objects owned by a shared
   development superuser.
3. Revoke runtime CREATE, ownership-role memberships and excess table privileges;
   grant only the runtime privileges above and SELECT on migration history.
4. Configure default privileges for each migration owner, including future
   tables/sequences. Default privileges do not update existing object grants.
5. Mount migration connection files only on jobs. Run the jobs, verify runtime
   permission denials, then verify registration, staking, payouts and recovery.

An automated legacy-volume upgrade, compatibility matrix, rollback/restore drill,
credential rotation and separate deployment approval pipeline remain OPS-09/
OPS-10 work. No existing development or production database is changed by the
repository tests.

## Verification

`npm run test:production` uses disposable secrets, containers and PostgreSQL
storage. It checks missing-migration startup failure, all ten role boundaries,
actual runtime DML and forbidden DDL/history writes, new-object default grants,
rejection of privileged runtime credentials, migration reruns/concurrency,
failure-gated startup and retry, service restarts, and the authenticated
stake/refund journey. `npm run test:ui` separately exercises Development's
automatic migrations, backend recovery and browser flows.

PostgreSQL references: [default privileges](https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html)
and [privilege inquiry functions](https://www.postgresql.org/docs/16/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE).
