# Settlement and testing

Predictions use earned virtual coins. This workflow moves coins within the
ledger; it does not implement purchases or cash withdrawals.

## Operator workflow and contracts

1. Create an open market with its outcomes and cutoff.
2. Lock admission with `POST /markets/{id}/lock`. A 409 while admitted debits
   are pending means the gate is closed but still draining; retry after recovery.
3. Submit `POST /markets/{id}/settle` with
   `{"winningOutcomeId":"<outcome UUID>","source":"<scorecard reference>"}`.
   Alternatively, cancel an open or locked market using
   `POST /markets/{id}/cancel` with `{"reason":"<cancellation reason>"}`.

These writes require an Admin bearer token at the gateway and owning service.
Source/reason is required and limited to 500 characters. Catalog records the
actor and request time. A matching repeat is safe; a conflicting decision is
rejected. A concurrent decision uses optimistic concurrency so only one wins.
Results cannot be edited after submission.

Catalog returns the market in `settling` or `refunding`. Its durable worker
requests a Settlement payout plan, then records `settled` or `cancelled` and
completion time after confirmation. A successful submission alone does not
mean coins have arrived. Admin displays the processing and final states.

`POST /pools/{id}/settle` remains an **admin-only ratio preview**. It does not
record a result or transfer coins.

## Allocation and recovery

Settlement persists one immutable plan per market after admission has closed
and pending debits have finished. Every accepted stake appears in the plan,
including losing stakes with zero payout.

For a winning stake, the exact share is its amount multiplied by the total
pool, divided by the total staked on the winning outcome. Integer quotients
are allocated first. Remaining coins go to the largest fractional remainders,
with ascending stake UUID breaking ties. Allocation is per stake; Wallet
aggregates transfers for stakes belonging to the same player. For example,
a pool of 11 with winning stakes of 2 and 3 returns 4 and 7 coins.

Cancellation or a winner with no accepted backing refunds each original stake
in full. Empty markets complete with a zero-total receipt. Ties need a defined
outcome or an operator cancellation policy; there is no automatic tie feed.

Wallet validates the plan against its accepted debit records and transfers
the whole market from escrow in one database transaction. A market receipt
stores the canonical payload hash and total. Identical retries return that
receipt; changed payloads conflict. Sorted account locks serialize concurrent
credits and debits. No partial market payout is committed.

Both Catalog and Settlement retry pending work every five seconds. If Wallet
commits but its response is lost, replay returns the receipt without another
credit. The workers recover after restart without storing player JWTs. An
outage can delay completion; it does not authorize choosing another result.

## Player history

`GET /predictions/me?limit=20&offset=0` requires a player token and returns only
that identity's records as `{items,nextOffset}`. Limits are 1–100; offsets are
0–1,000,000. Results are pending, active, processing, won, lost, refunded, or
rejected. Returned coins appear only after the payout is confirmed.

The platform's **My predictions** page polls the history, displays the selected
outcome, stake, confirmed return, and IST time, and supports pagination.

## Verification

Install Node dependencies with `npm ci`. Docker Compose and Python 3 are
required; Chromium is required for browser checks.

```bash
npx playwright install chromium
npm run test:all
```

`test:all` runs workspace typechecks followed by isolated backend and browser
checks. `npm run test:backend` runs the service suite alone. The test runner
creates a separate Compose project with temporary PostgreSQL storage and
random localhost ports, then removes its own containers. Browser servers use
ports 13001/13002 and `.next-e2e` output directories. The runner restores Next's
generated configuration files afterward. The development stack is untouched.

Coverage includes:

- Stake idempotency, insufficient funds, concurrent spending/reward claims,
  admission races, and recovery after committed debits or dependency outages.
- Admin authorization at gateway and service, category lifecycle, and branding
  validation and persistence.
- Exact payout rounding, immutable/concurrent results, cancellation,
  no-backed-winner refunds, empty markets, and repeated resolution.
- Recovery after a payout commits before completion is recorded, private
  history pagination, and double-entry/escrow reconciliation.
- Go unit tests and PostgreSQL tests, including randomized payout conservation.
- Chromium journeys through player staking/history, admin results/refunds,
  wallet balances, and branding/font changes.

`.github/workflows/product-tests.yml` runs the same suite and retains browser
failure traces. This is functional coverage, not load testing or a production
readiness certification.

## Existing environments

Migrations add result audit fields, payout plans, and wallet receipts. They do
not import historical in-memory pools or automatically pay markets already
marked settled by the earlier ratio-only workflow. Reconcile those records
before upgrading an environment containing valuable historical state. The
integration suite does not migrate or restart the normal development stack.
