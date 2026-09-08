# Backend services

Local-dev backend for the prediction-market product: coin-staked, pari-mutuel
markets settled off a match feed. Free-to-play for now — real-money coin
purchase is built into the Wallet service but sits behind a flag that's off
by default (see `Wallet.Infrastructure/Configuration/StaticEarnRateCatalog.cs`).

Each .NET service follows the same Clean Architecture layering:

```
{Service}.Domain          entities, invariants, repository interfaces — no framework deps
{Service}.Application     use cases (one class per operation), DTOs, app-level exceptions
{Service}.Infrastructure  EF Core, repositories, external concerns, DI composition
{Service}.Api             thin Program.cs, endpoint groups, HTTP <-> exception mapping
```

Dependencies only point inward (`Api` -> `Application`/`Infrastructure` -> `Domain`).
`Domain` never references EF Core, ASP.NET, or any other service.

The Go `settlement-engine` mirrors this with packages instead of projects:
`internal/domain` (the `Pool` aggregate and the `PoolRepository`/`WalletClient`
ports), `internal/service` (use-case orchestration behind those ports),
`internal/store` (the in-memory pool adapter) and `internal/walletclient`
(the HTTP adapter to Wallet) — each swappable later without touching the
other layers — and `internal/httpapi` (transport).

### How a stake actually moves money

`POST /pools/{marketId}/stakes` on Settlement Engine does **not** just add to
an in-memory total. It forwards the caller's own `Authorization` bearer token
to Wallet & Ledger's `POST /wallet/me/stake` *synchronously, before* touching
the pool — insufficient balance (402) or a missing/invalid token (401) rejects
the stake outright, so a pool can never hold a stake nobody actually paid for.
This is a direct HTTP call, not an event over NATS: a debit that must succeed
before a stake counts needs strong, immediate consistency, not eventual
consistency. Wallet records the debit as a normal double-entry ledger
transaction, moving coins from the player's account into a dedicated `Pool`
escrow account (`Account.PoolAccountId`) — separate from the `House` account
so "coins currently staked" and "coins issued as rewards" never get conflated
in the books. NATS stays unwired for now — publishing an audit event nobody
consumes yet would just be dead code; it's the right tool for the *next*
thing that needs fan-out (notifications, fraud signals), not for this.

## Services

| Service | Port | Stack | Owns | Swagger |
|---|---|---|---|---|
| **gateway** | **5100** | .NET 8 (YARP) | **single entry point — route here, not the ports below** | — |
| identity | 5101 | .NET 8 | register/login, issues JWTs | [/swagger](http://localhost:5101/swagger) |
| wallet-ledger | 5102 | .NET 8 | earned-coin double-entry ledger, validates JWTs | [/swagger](http://localhost:5102/swagger) |
| market-catalog | 5103 | .NET 8 | market/outcome lifecycle (open → locked → settled) | [/swagger](http://localhost:5103/swagger) |
| settlement-engine | 5201 | Go | pari-mutuel pool aggregation + payout computation | [/swagger](http://localhost:5201/swagger) |

**Everything client-facing should call the gateway (`:5100`), not the individual
service ports** — those stay open on the host for local debugging and
Swagger, but a frontend or a future mobile app only ever needs one base URL.
The gateway routes `/auth/*` and `/me` → identity, `/wallet/*` → wallet,
`/markets/*` → market-catalog, `/pools/*` → settlement-engine, and
JWT-authenticates a request at the edge whenever the matched route's
`appsettings.json` entry sets `"AuthorizationPolicy": "authenticated"` — an
unauthenticated call to a protected route gets rejected by the gateway and
never reaches the backend at all. Routes without that policy (`/auth/*`,
`/markets/*`, `GET /pools/*`) stay exactly as open as the service behind
them — the gateway never enforces auth a backend doesn't already enforce
itself, which would just be confusing. See
`services/gateway/Gateway.Api/appsettings.json` for the full route table.

Identity and Wallet's Swagger UI have an **Authorize** button — paste a token from
`POST /auth/login` in as `Bearer <token>` to call protected endpoints straight
from the browser. Market Catalog has no auth yet, so nothing to authorize there.
The Go service's UI is a hand-written `openapi.json` (see
`internal/httpapi/openapi.go`) rendered by swagger-ui loaded from a CDN — there
was no reason to pull in a codegen toolchain for four endpoints.

Postgres, Redis and NATS are shared local infra (see root `docker-compose.yml`).
Each .NET service owns its own Postgres **schema** (`identity`, `wallet`,
`market_catalog`) inside the same local `ravex` database used by `apps/web` —
that's a local-dev convenience, not a design decision to carry into staging/prod.

## Run locally

```bash
docker compose up -d --build
```

Health checks: `curl localhost:5101/health` (swap the port for 5102/5103/5201).

### Try the golden path

```bash
# register + log in
curl -s -X POST localhost:5101/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"fan@ravex.io","password":"password123","displayName":"IPL Fan"}'
TOKEN=$(curl -s -X POST localhost:5101/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"fan@ravex.io","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

# earn coins (daily_login | rewarded_ad | referral — each once per day)
curl -s -X POST localhost:5102/wallet/me/earn -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"reason":"daily_login"}'
curl -s localhost:5102/wallet/me/balance -H "Authorization: Bearer $TOKEN"

# create a market, stake (debits the wallet), lock, settle
MARKET=$(curl -s -X POST localhost:5103/markets -H 'Content-Type: application/json' \
  -d '{"title":"MI vs CSK","eventStartAt":"2027-03-20T14:00:00Z","outcomes":["MI","CSK"]}')
echo "$MARKET"
# ... take the market id + outcome ids from the response, then:
curl -s -X POST localhost:5201/pools/<marketId>/stakes -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"outcomeId":"<outcomeId>","amount":100}'
curl -s localhost:5102/wallet/me/balance -H "Authorization: Bearer $TOKEN"  # dropped by 100
curl -s -X POST localhost:5103/markets/<marketId>/lock
curl -s -X POST localhost:5201/pools/<marketId>/settle -H 'Content-Type: application/json' -d '{"winningOutcomeId":"<outcomeId>"}'
curl -s -X POST localhost:5103/markets/<marketId>/settle -H 'Content-Type: application/json' -d '{"winningOutcomeId":"<outcomeId>"}'
```

## Migrations

Each .NET service uses real EF Core migrations (not `EnsureCreated`) — the
`ravex` database already exists (it's shared with `apps/web`), so
`EnsureCreated` silently no-ops instead of creating the service's tables.
Each service's migration history lives in its own schema
(`identity.__ef_migrations_history`, etc.) so they can't collide with each
other or with `apps/web`'s Drizzle migrations.

To add a migration after changing an entity, from the repo root:

```bash
docker run --rm -v "$(pwd)":/src -w /src/services/<service-name> mcr.microsoft.com/dotnet/sdk:8.0 bash -c '
  dotnet tool install --global dotnet-ef --version 8.* && export PATH="$PATH:/root/.dotnet/tools"
  dotnet ef migrations add <Name> --project <Service>.Infrastructure/<Service>.Infrastructure.csproj --startup-project <Service>.Api/<Service>.Api.csproj -o Migrations
'
```

Migrations apply automatically on container start (`db.Database.Migrate()` in
each `Program.cs`).

## Known gaps (next steps, not yet built)

- Market Catalog has no auth on writes (admin auth isn't built yet) — the
  gateway matches that rather than being stricter than the backend.
- Settlement Engine's pools are still in-memory only — they reset on restart.
  Staking is wired to Wallet (see above), but **settlement isn't** — a
  winning payout is computed and returned, but nothing credits it back to
  winners' balances yet, and Settlement Engine doesn't track *which* user
  staked what (only aggregate totals per outcome), so that's the next piece,
  not just a wiring gap.
- No event bus wiring yet — NATS is running but nothing publishes to it.
