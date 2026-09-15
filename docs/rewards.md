# Rewards and public claim policy

The only directly claimable reward is `daily_login`, currently 50 earned coins
per authenticated player per UTC calendar day. This keeps the existing reset
boundary: midnight UTC is 05:30 IST. Coins are not cash and cannot be withdrawn.

## Contracts

`GET /wallet/me/rewards` requires a bearer token and returns a non-cacheable
snapshot:

```json
{
  "observedAt": "2026-09-14T10:00:00Z",
  "items": [
    { "reason": "daily_login", "amount": 50, "available": true, "nextAvailableAt": null }
  ]
}
```

After claiming, `available` is false and `nextAvailableAt` is the next UTC
midnight. The read is scoped to the authenticated identity and does not create
an account or change the ledger. Availability is informational; a concurrent
claim may consume the reward before another request arrives.

`POST /wallet/me/earn` accepts `{"reason":"daily_login"}`. Wallet chooses the
recipient from the validated JWT and the amount from its rate catalog. A
request cannot choose either. A transaction serializes the player's claim,
checks the latest positive claim entry, and commits the House debit and player
credit together. Claim validation and both entries use the same captured time.

- 200: credited, with the resulting balance.
- 409: already claimed for the current UTC day.
- 403: `rewarded_ad` or `referral` needs server verification and cannot be
  claimed directly, including by an administrator.
- 400: unknown/empty reason.
- 401: authentication required.

Adding a rate to the catalog does not authorize a new public earn reason.
Client-provided `verified`, `eventId`, `amount`, or `userId` fields do not grant
extra authority. The owning Wallet service enforces this policy independently
of gateway routing and frontend buttons.

The player wallet fetches amounts/availability, disables unavailable rewards,
shows the next reset in IST, refreshes after successful or uncertain claims,
and prevents overlapping clicks. After an ambiguous response, check the wallet
and availability before retrying. Day-level duplicate protection applies; this
is not a cross-day idempotency receipt protocol.

## Provider rewards remain disabled

There is no verified provider callback or referral-qualification flow yet.
Before enabling these rewards, choose the provider and define signed-event
verification, issuer/audience/user binding, time validity, replay protection,
unique event receipts committed with the ledger, referral eligibility,
self-referral/collusion defenses, abuse limits, and retention. Do not enable a
reward simply because a browser says an ad finished or supplies a referral ID.

This increment closes the public unverified-claim path. It does not solve
multi-account farming, login abuse, provider fraud or all reward-economy risks.
Those remain in the [enterprise register](enterprise-readiness.md).

## Upgrade and verification

No database migration is required. Existing daily claims continue to block
same-day claims. Historical ad/referral credits remain in the ledger; this
change does not reclaim previously granted coins. Older clients attempting
those claims receive 403 and should update their reward UI.

`npm run test:all` covers policy enforcement through Gateway and direct Wallet,
forged verification fields, server-owned amount/recipient, private read-only
availability, claim races, restart persistence, a simulated UTC reset, ledger
balance, and browser claiming/disabled state after reload.

Verification completed: the full `npm run test:all` run passed, including the
reward checks above and the existing settlement and operations regression suite.
No development-stack restart or production deployment was performed.
