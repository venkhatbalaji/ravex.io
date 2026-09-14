# Operations and recovery runbook

## Admin recovery view

Open **Operations** in the Admin app. It polls every five seconds and shows:

- Pending debit count and pending payout/refund plan count.
- Age of the oldest pending operation, using the server's snapshot time.
- An oldest-first, paginated queue with operation ID, market ID, kind, coins,
  creation time and last update time.
- Catalog results awaiting completion, including decisions for which a
  Settlement plan has not yet been created.

A five-minute-old operation displays an investigation notice. This is a UI
threshold, not an SLO, paging alert, or proof that a transfer failed. There is
no manual credit or force-complete action. Workers retry the original operation
with its existing idempotency identity. Refresh errors explicitly mark any
retained snapshot as potentially stale.

`GET /operations/settlement?limit=50&offset=0` requires an Admin token at
Gateway and Settlement. Limit is 1–100 and offset is 0–1,000,000. The response
contains `observedAt`, `pendingDebits`, `pendingResolutions`, `oldestPendingAt`,
`items`, and `nextOffset`. Counts and rows use one repeatable-read database
snapshot. It excludes player IDs, emails, tokens, and request keys and returns
`Cache-Control: no-store`. Counts cover the full pending queue, not only the
current page. Pending age is based on creation, not reset by retries.

Pagination uses offsets over a changing queue; completing operations can shift
later pages. Use Refresh or return to page one for the current view. This is
an operational view, not an immutable audit export. Counts scan pending work;
load-test backlog size before promising large-scale response times.

Migration `003_operations.sql` adds creation time to resolution plans. For
pre-existing plans it uses the last recorded update as an approximation; their
actual age may be greater. New plans have an immutable creation timestamp.
Last update is not a count of attempts and does not establish Wallet success.

## Health probes

| Endpoint | Success | Failure | Meaning |
| --- | --- | --- | --- |
| Each service `/health` | 200 | Unreachable if process unavailable | Liveness; independent of database/dependencies |
| Identity, Wallet, Catalog, Branding, Settlement `/health/ready` | 200 | 503 | Bounded database check; no database details returned |
| Gateway `/health/ready` | 200 | 503 | Every configured downstream cluster has at least one ready destination |

Readiness is public, minimal, and not cacheable. Gateway probes downstreams
concurrently. Database probes have a two-second cancellation budget; driver
cancellation/connection cleanup can add time. Gateway has a five-second overall
budget. Use an external probe timeout comfortably above that (for example,
eight seconds) and consecutive-failure thresholds to avoid reacting to a
single transient failure. Select production probe cadence after load testing.

Configure load balancers/orchestrators to use readiness for traffic admission
and liveness for process restarts. These endpoints alone do not configure your
hosting platform. The current gateway uses a conservative all-clusters-ready
policy: a Branding outage also makes the overall gateway unready. Route-specific
availability policies are future deployment work.

A successful probe does not validate every table, write permission, migration
compatibility, external provider, or sufficient capacity. Migrations still run
at service startup. Separate migration deployment and readiness governance are
tracked in the enterprise register.

## Investigating pending work

1. Record the market ID, operation ID, snapshot time and pending age. Check the
   Catalog decision in Admin Markets before interpreting a missing payout plan.
2. Check Gateway readiness, then each service directly on its private/admin
   network to identify the failing dependency. Keep public backend exposure
   restricted in production.
3. Inspect service logs around those IDs. Do not paste bearer tokens, internal
   keys or player data into tickets. Standardized tracing and redaction are
   still pending requirements.
4. Restore the failing dependency or configuration. Leave the original debit
   key/result/payout plan intact. Workers should advance within subsequent retry
   cycles. Observe confirmed Wallet totals and the final Catalog status.
5. If work remains pending while readiness is healthy, investigate receipt
   conflicts, data integrity, connection pressure and schema compatibility.
   Escalate to the owning service team. Do not delete receipts or edit the
   ledger/plan to clear the queue.

For debit uncertainty, retry the same client Idempotency-Key. For payout
uncertainty, the saved whole-market Wallet receipt is authoritative and retries
must match its payload. Backlog emptiness alone is not ledger reconciliation;
Catalog may still be recording completion and legacy records may need review.

## Verification

`npm run test:all` runs workspace typechecks, real HTTP/PostgreSQL integration,
Go checks, and Chromium journeys. Operational tests verify admin-only access,
parameter bounds, no player identifiers, empty and populated queues, pagination,
payout disappearance after recovery, and database outage/recovery behavior.

The database fault test pauses only the temporary Compose PostgreSQL container,
then unpauses it in `finally`. It does not stop or erase the development database.
All fake pending debit fixtures are removed while recovery is stopped, before
Wallet is restarted. The browser checks Admin navigation and session restoration
and stale-data warnings on the Operations page. Live backlog behavior is covered by real-service tests.

See [enterprise requirements](enterprise-readiness.md) for remaining alerting,
backup, security, deployment and tenant-isolation work.
