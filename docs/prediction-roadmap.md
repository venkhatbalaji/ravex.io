# Free-to-play prediction product: next milestones

This plan is based on the repository's current implementation. The first
release uses earned virtual coins. Cricket is a proposed first category,
based on the existing MI vs CSK example; other categories can use the same
market lifecycle.

## Current baseline

| Area | Implemented | Missing |
| --- | --- | --- |
| Identity | Email/password registration, login, JWT, roles (`Player`/`Admin`), controlled admin bootstrap | Session renewal, abuse controls, an admin-invite flow beyond the bootstrap |
| Wallet | Earned coins, atomic ledger debits, durable debit decisions, serialized reward claims | Winner credits, refunds, verified ad/referral rewards |
| Catalog | Create, list, lock, settle markets; categories; admin-only writes at gateway and service | Fixtures, cancellation, result audit trail |
| Settlement | Durable player stakes, admission gates, debit recovery, pool totals, payout ratio | Wallet payouts, refunds, result orchestration, admin role check on the settlement computation path |
| Branding | Theme (brand name, logo URLs, two accent colors, one of four fonts) and a copy-override dictionary, both admin-only to write, public to read; `apps/platform` applies both at runtime | Logo upload/object storage (URLs only), true multi-tenant multi-brand hosting |
| Platform | Login, registration, markets, stake form, wallet, dynamic branding/copy | Prediction history, rankings |
| Admin | `apps/admin` — markets (create/lock/settle), categories, branding, admin-only login | Fixtures, cancellation workflow, audit trail viewer |
| Infrastructure | Compose backend, PostgreSQL, Redis, NATS, gateway | Automated integration checks, readiness checks, operational monitoring |

The platform and admin frontends currently run separately with
`npm run dev:platform` / `npm run dev:admin`; neither is a service in
Compose. Redis and NATS are running but are not wired into the prediction
lifecycle.

See [docs/admin-and-white-label.md](admin-and-white-label.md) for what an
operator can configure today and how to get an admin account.

## 1. Complete a reliable prediction lifecycle

Target journey: register → claim coins → predict → market closes → result
is confirmed → wallet receives winnings or a refund → player sees the result.

### First increment: catalog validation (implemented)

Settlement now reads Market Catalog before debiting Wallet. The market must
exist, have status `open`, have an event start strictly in the future, and
contain the requested outcome. Invalid requests return 400, missing markets
404, closed markets 409, and dependency failures 502. Catalog failures do
not trigger a wallet debit.

The next increment adds a durable admission gate to coordinate this check
with market closure and removes the public Wallet debit primitive.

### Second increment: durable stake admission and wallet retry protection (implemented)

The items below are now implemented. New stakes persist in PostgreSQL, Wallet
saves terminal debit decisions atomically, and a background worker retries
pending operations without player tokens. The platform preserves the attempt
key in session storage and offers a safe check action after uncertain results.
Catalog closure blocks new admission immediately and waits for pending stakes
to finish. See [service contracts and upgrade notes](../services/README.md).

Implementation checklist:

- Add a Settlement-owned PostgreSQL schema and migrations. Store each stake's
  ID, authenticated player ID, market ID, outcome ID, integer coin amount,
  state, and timestamps. Derive pool totals from accepted records.
- Persist an admission intent before requesting a debit. Use the stake ID
  as the Wallet idempotency key. Retrying the same operation returns the
  previous result; reusing its key with a different payload is rejected.
- Make sufficient-balance checking and the two ledger entries one database
  transaction with account-level serialization. Apply the same atomicity
  principle to once-per-day claims; the current check-then-write can race.
- Replace the publicly callable debit primitive with a service-authorized
  operation bound to the admitted stake and verified player identity.
  Enforce this in Wallet, not just in gateway routing.
- Give Settlement a durable admission gate for each market. Closing that gate
  must serialize with new stake admission. Define whether admitted, pending
  debits finish or are refunded before finalizing a market result.
- Recover pending operations after timeouts or restarts by querying or
  retrying the idempotent wallet operation. Never assume a timeout means
  the wallet did not debit. Do not persist bearer tokens in recovery records.

Verified in the isolated Docker integration suite: a restart preserves
stakes; duplicate submissions debit once; parallel stakes cannot overdraw an
account; a committed debit with a lost response is recovered without a second
charge; market closure and admission races have a tested ordering. Ledger
entries balance and accepted stakes reconcile with escrow.

Historical in-memory pools are not imported automatically. Their old wallet
debits remain, so reconcile them before replacing an existing environment.

### Next increment: settlement, payouts, and refunds

- Persist one result and one payout plan per market. Only a trusted result
  workflow can finalize it; a player cannot submit a winning outcome.
- Calculate payouts per player using integer arithmetic. Record a deterministic
  remainder allocation so the sum of payouts equals the distributable pool.
- Credit winners from escrow with unique payout IDs. Retry partial processing
  without paying anyone twice. Mark settlement complete only after every
  planned transfer has been confirmed.
- Define and implement cancellation, abandoned matches, ties, and a winning
  outcome with no stakes. Proposed initial rule for cancelled markets and
  zero winning stakes: return every accepted stake in full.
- Reconcile accepted stakes, escrow debits, payouts, and refunds. Expose
  stuck operations to administrators with a safe retry action.

Acceptance: two players stake on different outcomes; the winner receives
the correct pool payout, the loser receives none, repeat settlement changes
no balances, and cancellation refunds exactly once. Inject failures between
each service call and prove recovery preserves the ledger totals.

## 2. Make market operations usable

Build backend authorization alongside milestone 1, before exposing result
or payout actions. Then add a dedicated `/admin` experience.

- Provision an administrator through a controlled setup operation; do not
  allow public registration to choose its role.
- Protect catalog writes and settlement at each owning service. Preserve
  public market reads and authenticated player staking.
- Separate fixtures from prediction markets: competition, teams, start time,
  result source, and one or more questions with defined settlement rules.
- Create drafts, publish markets, close admission, enter results with source
  evidence, preview payouts, and view processing status.
- Record the actor, action, timestamp, and result for every administrative
  mutation. Move create/lock/settle controls out of player-facing pages.
- Add admin role checks to the settlement computation path. The platform now
  sends a token, matching the gateway's authenticated pool POST routes.

Acceptance: ordinary players get 403 on administrative actions; admins can
complete the entire market lifecycle through the gateway with an audit trail.

## 3. Build the player experience

- Add `/predictions` with pending, won, lost, and refunded entries backed by
  durable player stakes. Show stake, outcome, result, and confirmed payout.
- Improve discovery with upcoming/live/completed filters, category selection,
  pagination, and useful empty states.
- Show match times clearly in IST and enforce cutoffs on the server. Disable
  the stake form at cutoff and refresh market/pool/balance data after actions.
- Explain that pool proportions can change before closing; the current
  implied-odds display is not a guaranteed payout quote.
- Add rankings only after the accepted-stake and settlement data is reliable.
  Define scoring, minimum participation, ties, and season boundaries first.

Acceptance: a player can follow every coin from claim to stake to final
result without needing an admin or a direct API call.

## 4. Prepare a small beta

- Keep the free-coin economy explicit in UI and configuration. Only grant
  ad/referral rewards after server-verifiable events; the current earn API
  accepts those reasons directly from the caller.
- Add rate limits, session expiry handling, restricted CORS, environment
  secrets, dependency readiness, structured logs, and request correlation.
- Automate service tests and the full gateway journey in CI, including
  concurrent requests, duplicate messages, dependency failures, and restarts.
- Add backup/restore verification and metrics for pending debits, failed
  payouts, ledger reconciliation, and API failures.
- Add a platform Docker image and Compose service if a single-command
  frontend/backend environment is the desired development workflow.
- Introduce NATS with a transactional outbox when a concrete consumer needs
  settlement events (for example, notifications or leaderboard updates).
  Keep authoritative debit and payout confirmation in the ledger workflow.

## Architecture boundaries

Keep the existing .NET Clean Architecture layers and Go ports/adapters.
Identity owns identity and roles; Catalog owns market definitions and
results; Settlement owns admission, player stakes, and payout orchestration;
Wallet owns coin movement and ledger invariants. Each service accesses its
own persistence and uses explicit API contracts for the others. Extend the
current services before adding more microservices.

## Verify the implemented increments

From the repository root, with Docker and Python 3 available:

```bash
python3 services/tests/stake_lifecycle.py
npm run typecheck --workspace=@ravex/platform
```

The test runner builds an isolated Compose project, exercises real services
and PostgreSQL, and tears down its own containers. It includes Go handler,
cutoff, persistence, concurrent admission, and recovery tests. The existing
development stack is not restarted by these checks.
