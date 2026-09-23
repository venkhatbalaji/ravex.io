# Browser session lifecycle

The player and Admin apps share `@ravex/browser-session`. This implements the
browser portion of SEC-04; it does not introduce refresh tokens or server-side
session revocation. The marketing/chat app has its own authentication system.

## Restoration and expiry

After reload, a saved token is verified through Identity's `GET /me` before
private queries or Admin controls become available. Admin also requires the
verified user's Admin role. Malformed tokens, missing/invalid expiry, expired
tokens and authenticated HTTP 401 responses clear the local session.
Sign-in and registration forms wait for this check so restoration cannot
discard credentials while they are being entered.

Network errors, a 15-second verification timeout, and non-401 errors retain the
saved token but hide authenticated controls and data. A notice offers retry or
clear-session actions. Returning online, focusing the tab or making it visible
also retries unavailable verification. Admin remains on the requested page
during an outage rather than redirecting to login.

An expiry timer clears an active session, with additional checks on focus and
visibility changes for suspended tabs. The JWT expiry is decoded only to manage
browser state; server signature, lifetime and authorization checks remain
authoritative. Browser clock skew can therefore sign a user out early. This
increment does not extend a JWT's lifetime.

Authenticated fetches use `cache: "no-store"`. Each captures the local session
generation before sending. A late 401 from a previous generation cannot clear a
new login, even if Identity reissues the same JWT. Verification responses are
also guarded against logout/account changes, and obsolete verification fetches
are aborted. Failed writes are never automatically replayed by session recovery.

## Logout, account changes and private state

Logout and identity changes synchronize through localStorage events in other
tabs on the same origin. Focus also checks the current stored token. Player and
Admin retain separate storage keys and origins; logging out of one app does not
log out of the other app or another device.

Identity transitions cancel and remove private React Query caches (wallet
balance, rewards, ledger, predictions and Admin recovery backlog). The session
boundary remounts descendants to discard private forms and transient messages.
Public market, category and branding caches can remain. New private query types
must be added to the owning app's auth-provider cleanup set.

Prediction attempt keys remain in sessionStorage, scoped by user and market.
An uncertain response can represent an accepted debit, so logout must not delete
the receipt. After the same user signs in again in that tab, **Check prediction**
explicitly retries the original key. Another account does not see that attempt.
Recovery does not submit stakes or claim rewards automatically.

If browser storage is unavailable, login can continue in memory for the current
tab, with a visible notice. Logout still clears memory, and a failed storage
removal cannot reauthenticate the tab on focus. Persistence and cross-tab
synchronization cannot be guaranteed when the browser denies storage operations.

## Remaining boundaries

Tokens are still bearer tokens stored in localStorage. A copied token remains
valid at the server until expiry; this browser logout does not revoke it.
SEC-04 still needs a server-side renewal, rotation and revocation design,
all-device logout and associated integration tests. SEC-05 still needs the
cookie/BFF decision, XSS defenses and CSP/CSRF controls appropriate to that design.
Client-side hiding and cache cleanup do not replace service authorization.

## Verification

Run `npm run typecheck --workspaces --if-present` and `npm run test:ui`.
The latter includes the real-service/PostgreSQL and Go regressions plus Chromium.
`tests/e2e/sessions.spec.ts` covers auth forms waiting for verification, both
apps' retryable restoration, verification
timeouts and reconnect recovery, invalid saved expiry, protected 401 versus 403
handling, cross-tab logout and expiry, and the Admin role check on restoration.
It also checks account data isolation, a late 401 for an identical reissued
token, blocked browser storage, logout during restoration, failed storage
removal, and same-key prediction recovery after a simulated 401 following an
accepted debit.
