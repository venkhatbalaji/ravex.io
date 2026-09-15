# Gateway request limits

The gateway now applies configurable fixed-window quotas to public POST
requests. Authentication and route authorization run before the limiter;
rejected requests never reach the downstream service.

| Path prefix | Default quota | Partition |
| --- | --- | --- |
| `/auth` | 30 requests / 60 seconds | Connection IP, including authenticated callers |
| `/wallet` | 10 requests / 60 seconds | Validated user ID; otherwise connection IP |
| `/pools` | 60 requests / 60 seconds | Validated user ID; otherwise connection IP |

Each group has its own quota. Prefix comparison is case-insensitive and covers
trailing slashes and subpaths. Pool previews share the pool-write quota. Read
requests, health probes, CORS preflights and unrelated admin writes are outside
these policies. Authentication attempts count even when credentials are wrong;
authorized downstream failures and duplicate claims/stakes also consume quota.

The limiter uses the validated JWT identity, never an unvalidated token or
caller-provided user ID. Refreshing a token does not create another user quota.
IP keys use the network connection, not `X-Forwarded-For` or `X-Real-IP`.

## Configuration

Set these gateway environment variables before startup:

```text
RequestLimits__WindowSeconds=60
RequestLimits__AuthPermits=30
RequestLimits__EarnPermits=10
RequestLimits__StakePermits=60
```

Window must be 1–3600 seconds and each permit count 1–100000. Invalid settings
fail startup. The defaults are initial guardrails, not capacity targets. Choose
production values from expected traffic, NAT/proxy topology and abuse testing.

Responses exceeding the quota are HTTP 429 with `Cache-Control: no-store`, a
whole-second `Retry-After` header, and JSON `error` / `retryAfterSeconds`. CORS
exposes `Retry-After` to allowed browser origins. Requests are rejected rather
than queued. The existing clients display the error. For an uncertain stake,
keep the original Idempotency-Key when retrying after the delay. A 429 does not
cancel an earlier admitted stake or a pending payout.

## Scope and production limitations

Counters are held **per gateway process** and reset on restart. Multiple
replicas multiply the available quota; this does not provide distributed rate
enforcement. Fixed windows can also allow bursts around a reset boundary.
Distributed/edge enforcement, concurrency limits, bot defenses, per-account
login protections and rate-limit telemetry remain enterprise requirements.

Backend ports are exposed for local debugging. Direct requests bypass gateway
quotas, although service authentication, reward policy and ledger invariants
still apply. Restrict backend ports to private networks in production and add
owning-service controls where necessary. Do not expose the test-only limited
gateway as an alternate production ingress.

Behind a reverse proxy, the connection IP is the proxy's address. This can
combine authentication traffic into one quota. Configure an explicit trusted
proxy boundary before using forwarded client addresses; never accept arbitrary
forwarding headers or enable forwarded-header processing without reviewing
trusted proxies/networks. This increment does not add that deployment-specific
trust configuration. Unauthorized wallet/pool requests are rejected by route
authorization before quota accounting; edge controls must also cover invalid
JWT floods and non-POST traffic.

## Verification

The isolated test stack has a separate `limited-gateway` using three permits
per ten-second window. The main integration gateway uses larger quotas so
concurrency tests exercise Wallet/Settlement invariants independently.

`npm run test:all` verifies 429 responses, delay headers and CORS exposure,
forwarded-header spoof resistance, path case/trailing-slash handling, per-user
isolation, unchanged quotas after token renewal, read availability, window
reset, and same-key prediction retries without a second debit. Existing reward,
settlement, readiness and browser regression tests run in the same suite.

Verified locally on 2026-09-15: the full `npm run test:all` suite passed.
