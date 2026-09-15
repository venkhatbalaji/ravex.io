# Backend services

Free-to-play, coin-staked prediction markets with manually entered results.
Wallet issues earned virtual coins and settles winnings/refunds. Purchases
and a match feed are not implemented. See the [product roadmap](../docs/prediction-roadmap.md).

## Architecture

Each .NET service uses Clean Architecture:

```text
Domain          entities, invariants, repository interfaces
Application     use cases, contracts, transaction and service ports
Infrastructure  EF Core, PostgreSQL transactions, HTTP adapters, DI
Api             endpoints, authentication, HTTP error mapping
```

Dependencies point inward. The Go Settlement service follows the same
boundaries: `internal/domain`, `internal/service`, `internal/store`, and HTTP
adapters for Catalog, Identity, and Wallet. Each service owns its persistence;
services never query another service's tables.

| Service | Local port | Owns |
| --- | --- | --- |
| gateway (.NET/YARP) | 5100 | Public entry point, route authentication and authorization |
| identity (.NET) | 5101 | Registration, login, JWTs, roles |
| wallet-ledger (.NET) | 5102 | Coin balances, ledger, durable debit decisions and payout receipts |
| market-catalog (.NET) | 5103 | Market definitions, categories, lock/result lifecycle |
| branding (.NET) | 5104 | White-label theme and text-copy overrides |
| settlement-engine (Go) | 5201 | Durable player stakes, admission gates, payout plans and recovery |

Clients call gateway `:5100`. Other ports are exposed for local debugging.
Gateway routes `/auth/*` and `/me` to Identity, `/wallet/*` to Wallet,
`/markets/*` and `/categories/*` to Catalog, `/pools/*` and `/predictions/*` to Settlement, and
`/branding/*` to Branding. `/operations/settlement` is an admin-only recovery
backlog view owned by Settlement. `/internal/*` endpoints are not routed by Gateway
and require `X-Service-Key` at the owning service.

Every write route on Catalog and Branding — creating/locking/settling a
market, creating/renaming/deleting a category, updating theme or copy — is
gated behind the gateway's `admin` policy (`RequireRole("Admin")`) and
re-checked at the owning service itself, the same defense-in-depth pattern
already used for `authenticated` routes. Read routes on both stay public. See
[Roles, categories, and white-label branding](#roles-categories-and-white-label-branding).

The .NET services expose `/swagger`; Settlement exposes `/swagger` and
`/openapi.json`. Each service has `/health` for liveness and `/health/ready` for dependency
readiness. See the [operations runbook](../docs/operations.md). PostgreSQL schemas are `identity`,
`wallet`, `market_catalog`, `settlement`, and `branding` in the local `ravex`
database. Redis and NATS are available in Compose but currently unused.

## Stake admission and recovery

1. The client sends `POST /pools/{marketId}/stakes` with its bearer token,
   a UUID `Idempotency-Key` header, and `{ "outcomeId": "...", "amount": 10 }`.
   The platform saves this attempt in session storage before sending it.
2. Settlement authenticates the player through Identity `/me`; the request
   cannot choose a user ID. Catalog supplies the market and valid outcomes.
3. A Settlement database transaction serializes the player's idempotency key
   and market admission gate. An existing matching intent is returned even
   after cutoff; different payloads conflict. New intents require an open
   market, valid outcome, open gate, and a future cutoff.
4. Settlement commits the intent before calling Wallet
   `POST /internal/stakes/{stakeId}` using `X-Service-Key`. The body contains
   the verified player ID, market, outcome, and coin amount. The former public
   `POST /wallet/me/stake` endpoint has been removed.
5. Wallet serializes the operation and player, checks funds, and commits the
   decision with both ledger entries in one transaction. Funds move from the
   player to Pool escrow. Both acceptance and insufficient-funds rejection
   are durable. Replaying the ID returns the original decision; conflicting
   payloads return 409. Daily reward claims use the same player lock.
6. Settlement marks the intent accepted or rejected. Only accepted records
   contribute to pool totals. A lost response leaves the intent pending.
   A worker retries pending intents every five seconds with the same stake
   ID, including after restart, without storing player bearer tokens.

HTTP 200 means accepted; 202 means admitted and still processing; 402 means
rejected for insufficient funds. **Retry the same key after a timeout, 202,
or 5xx.** A fresh key expresses a new prediction. Keys are scoped per player;
retries return the same stake, alongside the current pool snapshot.

Market locking first closes Settlement's durable gate. Requests admitted
before closure are allowed to complete. While any are pending, Catalog's
lock endpoint returns 409 and its status remains unchanged, but new stakes
are blocked by the gate. Retry locking after recovery finishes. Catalog only
persists `locked` after the gate has drained. Settlement ratio computation
also requires a closed gate and no pending stakes.

## Results, payouts, and refunds

Admin records a locked market's result with `POST /markets/{id}/settle`
(`winningOutcomeId`, `source`) or cancels an open/locked market with
`POST /markets/{id}/cancel` (`reason`). Durable workers pay or refund accepted
stakes; final status follows Wallet confirmation. Players see their own
records through `GET /predictions/me` and the platform history page.

See [settlement and testing](../docs/settlement-and-testing.md) for contracts,
integer rounding, retry guarantees, and legacy-data limitations.

## Roles, categories, and white-label branding

Full detail, including the complete copy-key list and how to extend the
system, lives in [docs/admin-and-white-label.md](../docs/admin-and-white-label.md).
Summary:

- **Roles.** `Identity.Domain.Entities.User` has a `Role` (`Player` or
  `Admin`), included as a `ClaimTypes.Role` claim on every issued JWT.
  Public `/auth/register` always creates a `Player` — an `Admin` account can
  only come from Identity's startup bootstrap
  (`ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`, idempotent, safe to
  leave set across restarts). This is the roadmap's "controlled setup
  operation," not a general-purpose invite flow.
- **Categories.** A `Category` entity in Market Catalog (`Id`, `Name`);
  `Market.CategoryId` is optional and validated against the repository at
  create time. Deleting a category un-categorizes its markets (`SetNull`)
  rather than blocking the delete or cascading.
- **Branding.** The new `branding` service owns exactly two things: a
  singleton `Theme` (brand name, two logo URLs, two accent colors, a font
  from a short fixed list) and a `CopyOverride` key→string dictionary. Both
  are public to read and admin-only to write. `apps/platform` fetches both
  once on load and applies them at runtime — CSS custom properties for
  theme, a lookup dictionary for copy — falling back to its built-in
  defaults if branding was never configured or the fetch fails. This is
  intentionally **not** full multi-tenant white-labeling: it configures the
  one active brand for this deployment, not many brands at once. `apps/admin`
  (`npm run dev:admin`, port 3002) is the operator UI for all three of these.

## Run locally

```bash
docker compose up -d --build
npm run dev:platform   # player app, :3001
npm run dev:admin      # admin app, :3002 — requires an Admin account, see below
```

Compose provides local-only credentials. Set `INTERNAL_SERVICE_KEY` to a
shared secret of at least 32 characters for Wallet, Catalog, and Settlement
outside the local defaults. Settlement also accepts `SETTLEMENT_DB_CONNECTION`,
`WALLET_SERVICE_URL`, `MARKET_CATALOG_SERVICE_URL`, and `IDENTITY_SERVICE_URL`.
Catalog uses `SETTLEMENT_SERVICE_URL` to close admission. Identity's
`ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` (defaults:
`admin@predictplay.local` / a dev-only password — see `docker-compose.yml`,
change both outside local dev) seed the one Admin account this deployment
starts with. Configuration is in root `docker-compose.yml`. Gateway permits
browser requests from `http://localhost:3001`, including the idempotency
header. Configure `Cors:AllowedOrigins` (for example `Cors__AllowedOrigins__0`)
for another platform origin, including `apps/admin`'s if it's deployed
somewhere other than `:3002`.

### Upgrading from the in-memory Settlement version

New stakes and decisions survive restarts. Existing in-memory pools from the
old version are **not imported**: they lack player IDs and stable stake IDs.
Their historical Wallet debits remain in the ledger. Capture and reconcile
those old pools before replacing an environment containing stakes you need
to retain; do not assume rebuilding reconstructs them. The migrations only
add tables and do not delete historical ledger entries.

### Gateway walkthrough

```bash
curl -s -X POST localhost:5100/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"fan@ravex.io","password":"password123","displayName":"IPL Fan"}'
TOKEN=$(curl -s -X POST localhost:5100/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"fan@ravex.io","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s -X POST localhost:5100/wallet/me/earn -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"reason":"daily_login"}'
# Set ADMIN_TOKEN from an administrator login first.
curl -s -X POST localhost:5100/markets -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"MI vs CSK","eventStartAt":"2027-03-20T14:00:00Z","outcomes":["MI","CSK"]}'
# Use the returned market and outcome IDs below, and keep this key for retries.
STAKE_KEY=$(python3 -c 'import uuid;print(uuid.uuid4())')
curl -s -X POST localhost:5100/pools/<marketId>/stakes \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $STAKE_KEY" \
  -H 'Content-Type: application/json' -d '{"outcomeId":"<outcomeId>","amount":10}'
curl -s localhost:5100/wallet/me/balance -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:5100/markets/<marketId>/lock -H "Authorization: Bearer $ADMIN_TOKEN"
# Admin-only preview: this computes a ratio; it does not pay winners.
curl -s -X POST localhost:5100/pools/<marketId>/settle \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"winningOutcomeId":"<outcomeId>"}'
```

## Migrations and checks

.NET services apply EF migrations on startup, with separate migration history
per schema. Add an EF migration using the matching Infrastructure project and
Api startup project; pin `dotnet-ef` to version `8.0.10`. Settlement embeds
ordered SQL migrations from `internal/store/migrations`; it applies unapplied
files at startup under a database advisory lock and records them in
`settlement.schema_migrations`.

Run the full isolated integration suite with Docker and Python 3:

```bash
python3 services/tests/stake_lifecycle.py
```

It builds a separate Compose project with temporary PostgreSQL storage and
random localhost ports, runs real HTTP and PostgreSQL tests, then removes its
containers. It never restarts the development stack. Tests cover duplicate
stakes, conflicting keys, overspend races, concurrent reward claims, service
authorization, pending debits, response-loss recovery, market admission races,
restart persistence, and ledger reconciliation.

Fast Go checks (PostgreSQL tests skip unless `TEST_DATABASE_URL` is set):

```bash
docker run --rm -v "$PWD/services/settlement-engine:/src" -w /src golang:1.22-alpine sh -c 'go test ./... && go vet ./...'
npm run typecheck --workspace=@ravex/platform
```

For typechecks, backend integration, and Chromium journeys together, run
`npm run test:all` after `npx playwright install chromium`. CI runs this same
command. See [test coverage](../docs/settlement-and-testing.md#verification).

## Remaining product gaps

- Fixtures, automatic result feeds, rankings, and an admin audit/backlog viewer.
- Ad/referral rewards are disabled for direct claims. Provider verification,
  rate limits and broader fraud controls remain to build. See [reward contracts](../docs/rewards.md).
- Historical in-memory pools and already-settled legacy markets are not
  automatically migrated or paid. Reconcile them before an upgrade.
