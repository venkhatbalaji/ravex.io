# Production configuration baseline

`compose.production.yml` is a standalone backend deployment baseline. Do not merge
it with the development Compose file. It publishes only the gateway on loopback;
place an HTTPS reverse proxy on the host in front of it. Frontend deployment,
certificates, backups, monitoring and high availability remain separate work.

Create credentials in a new directory outside the repository:

```sh
python3 infra/production/generate_secrets.py /secure/path/ravex-secrets
export RAVEX_SECRETS_DIR=/secure/path/ravex-secrets
export ADMIN_BOOTSTRAP_EMAIL=operator@example.com
export PLATFORM_ORIGIN=https://play.example.com
export ADMIN_ORIGIN=https://admin.example.com
docker compose -f compose.production.yml up -d --build
```

The generator refuses to overwrite an existing directory and creates files with
mode 0444 inside a 0700 directory. The private directory prevents other host users
from accessing the files; read-only file permissions let containers with different
UIDs read their individually mounted secrets. Keep the parent private and never
copy these files into a shared directory. Back up credentials securely. Compose secrets
are mounted files, not an encrypted secret manager. `.secrets/` is ignored by Git
and the root Docker build context, but prefer storage outside the checkout.

Every host reads its supported secret through `KEY_FILE` or `KEY`; specifying
both fails startup. Outside explicit `Development`, missing, short (under 32
UTF-8 bytes), or known development placeholder secrets fail before migrations or
HTTP startup. Migration jobs require only their database credentials and optional
Identity bootstrap credentials. Runtime JWT and internal keys must differ in hosts
that consume both.
Identity also validates any configured bootstrap credentials. This checks basic
configuration, not entropy or rotation. Database connection files use canonical
`Username` and `Password` keys for .NET and URL authority credentials for Go.

A fresh PostgreSQL volume initializes separate runtime and migration roles for
each of the five service schemas. Migration roles own their schemas; runtime
roles have DML access and read-only migration history, with no DDL or ownership
privileges. Dedicated migration jobs apply schema changes and seed data before
each runtime is allowed to start. See [migration modes, permissions, release
commands and existing-volume upgrade requirements](database-migrations.md).
Backend networking is private; the gateway also has an edge network. Service containers have read-only root filesystems,
a writable temporary directory, dropped capabilities and no privilege escalation.
Internal traffic currently uses HTTP and PostgreSQL without TLS on that private
network; this is not a complete production security boundary.

The initializer runs only for a new volume. This configuration does **not** migrate
existing development data or rotate existing PostgreSQL passwords when files
change. Plan and test data migration, backup restoration and coordinated credential
rotation before using it for an existing installation. Never remove a live volume
to re-run initialization. Bootstrap is for the initial administrator; after setup,
remove the bootstrap email, password-file environment entry and secret mount from
`identity-migrate` job configuration. Runtime Identity has no bootstrap secret.
Existing users are not promoted by changing the bootstrap email.

Run `npm run test:production` to build a disposable isolated deployment, verify
migrations/readiness, migration failure and retry, runtime privilege denials,
and an authenticated stake/refund flow, private ports, schema access denial and
rejection of development secrets. It deletes only its own containers and volume afterward.
