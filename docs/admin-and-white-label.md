# Admin & white-label configuration

What an operator can change about this deployment without a rebuild, how to
get the first admin account, and how to run the tool that does it.

## What's actually white-label today

This configures **one active brand for this deployment** — it is not yet
multi-tenant (many brands served from one running system). That's a
deliberate scope boundary, not an oversight: see
[docs/prediction-roadmap.md](prediction-roadmap.md) for what a genuine
multi-tenant hosting model would add on top of this.

| Configurable now | Not yet |
| --- | --- |
| Brand name | Per-tenant multi-brand hosting (one deployment = one brand) |
| Logo (light mode + dark mode), as a pasted URL | Logo file upload / object storage — paste a URL to something already hosted |
| Primary + secondary accent color | Arbitrary CSS — colors are two fields, not a full theme file |
| Display/body font, from four supported choices | Any font — the list is fixed on purpose (see below) |
| Any of the ~20 documented copy strings | Full multi-language i18n — this is one override dictionary, not translations |
| Market categories (create/rename/delete) | Nested categories, market tagging beyond one category per market |

## Getting an admin account

There is no "sign up as admin" flow, and there never should be — Identity's
public `/auth/register` always creates a `Player` account, full stop. The
**only** way an `Admin` account exists is Identity's startup bootstrap:

```yaml
# docker-compose.yml, identity service
ADMIN_BOOTSTRAP_EMAIL: admin@predictplay.local          # change outside local dev
ADMIN_BOOTSTRAP_PASSWORD: dev-only-admin-password-change-me!  # change outside local dev
```

On every startup, Identity checks whether a user with that email already
exists; if not, it creates exactly one `Admin` account with that email and
password. It's idempotent — leaving the variables set across restarts does
nothing once the account exists. There's no path from a `Player` account to
`Admin` today; promoting someone means creating a second bootstrap-style
account (or, later, a real admin-invite flow — not built yet).

Log in with those credentials in `apps/admin` (or via `POST /auth/login`
directly). The issued JWT carries a `role` claim (`Player` or `Admin`); every
admin-only endpoint — at the gateway *and* the owning service, the same
defense-in-depth pattern the rest of this backend already uses — checks it
with `RequireRole("Admin")`.

## Running the admin app

```bash
cp apps/admin/.env.example apps/admin/.env.local
npm run dev:admin
```

Opens on **http://localhost:3002**. It talks to the same gateway
(`:5100`) as `apps/platform`, just with admin-only routes unlocked by the
token it holds. It is deliberately **not** themed by the brand it's
configuring — that would be circular, and every white-label deployment's
admin tool would look different from every other one. It has its own fixed,
neutral palette (see `apps/admin/app/globals.css`) with the same dark/light
toggle mechanics as the player app.

Four pages:

- **Markets** (`/markets`) — create, lock, resolve, and cancel markets, with a
  category picker. This is where `apps/platform`'s create/lock/settle
  controls moved *from* — the player app is read/stake-only now.
- **Operations** (`/operations`) — pending coin transfers, oldest pending age,
  paginated recovery backlog and Catalog decisions awaiting completion.
- **Categories** (`/categories`) — create, rename, delete.
- **Branding** (`/branding`) — the theme form and the copy-override table.

## Recording a result or cancellation

Lock a market before choosing the winning outcome. Enter a scorecard reference
or other evidence and select **Record result and pay**. The result is final:
conflicting later submissions are rejected. The table shows `settling` until
Wallet confirms the full payout, then `settled` with completion time.

For an open or locked market, enter the cancellation reason and select
**Cancel and refund**. Status moves through `refunding` to `cancelled`.
Cancellation and results with no stakes on the winner return original stakes
in full. During a dependency outage, leave the recorded decision in place;
workers retry it after recovery. Players see confirmed returns in
**My predictions**. [Details and tests](settlement-and-testing.md).

## How the player app picks it up

`apps/platform` fetches `GET /branding/theme` and `GET /branding/copy` once
on load (`context/branding-context.tsx`, `BrandingProvider`) and applies them
at runtime:

- **Theme** — `accentColor`/`accent2Color` are set directly as CSS custom
  properties (`--accent`, `--accent-2`) via `document.documentElement.style`;
  every component already reads color through these tokens, so nothing else
  needs to change. The selected font swaps `--font-display-active`/
  `--font-body-active` to point at whichever of the four preloaded
  `next/font` variables matches. `brandName`/`logoLightUrl`/`logoDarkUrl`
  feed the `Logo` component directly (`components/logo.tsx`), which falls
  back to the built-in Predict Play lockup images when a field is empty.
- **Copy** — every string a component wants to be overridable calls
  `useCopy(key, fallbackText)`. If the admin has set that key, the override
  wins; otherwise the fallback (the app's actual built-in text) renders
  exactly as before. Nothing breaks if branding was never configured, or the
  branding service is temporarily unreachable — both queries use
  `retry: false` and just fall through to defaults.

This is why the font list is fixed to four (Fredoka, Nunito, Poppins, Space
Grotesk): all four load in `apps/platform/app/layout.tsx` via `next/font`
regardless of which is active, so switching is a CSS variable change, not a
new network request. The real cost is that the bundle always ships all four
font files rather than just the active one — worth it for zero-rebuild
switching, but worth being honest about; it's not free.

## The full copy-key list

Every key `apps/platform` actually reads. The admin Branding page shows the
same list with human-readable labels — this is its source of truth.

| Key | Default | Where it renders |
| --- | --- | --- |
| `nav.linkMarkets` | Markets | Nav bar link |
| `nav.linkPredictions` | My predictions | Nav bar link |
| `predictions.heading` | My predictions | Prediction history heading |
| `nav.linkWallet` | Wallet | Nav bar link |
| `nav.logIn` | Log in | Nav bar link |
| `nav.register` | Register | Nav bar button |
| `nav.logOut` | Log out | Nav bar button |
| `hero.eyebrow` | Live Markets | Markets page hero |
| `hero.heading1` | Predict the match. | Markets page hero |
| `hero.heading2` | Win the powerplay. | Markets page hero (accent line) |
| `hero.subheading` | Free coins, real pari-mutuel odds. Stake on an outcome before the market locks — the pool sets the price, not the house. | Markets page hero |
| `markets.heading` | All markets | Markets page section heading |
| `markets.emptyState` | No markets yet — check back soon. | Markets page, no markets |
| `market.stakeHeading` | Place a stake | Market detail page |
| `market.stakeLoginPrompt` | Log in to stake — this debits your wallet for real. | Market detail page, logged out |
| `market.stakeButton` | Stake | Market detail page (only the base state — "Checking…" and "Check prediction" are transient idempotent-retry states, not brand copy) |
| `wallet.heading` | Wallet | Wallet page |
| `wallet.earnDailyLogin` | Daily login bonus | Wallet page earn button |
| `wallet.earnRewardedAd` | Watch a rewarded ad | Wallet page earn button |
| `wallet.earnReferral` | Referral bonus | Wallet page earn button |
| `wallet.recentActivity` | Recent activity | Wallet page section heading |
| `auth.loginHeading` | Log in | Login page |
| `auth.registerHeading` | Create an account | Register page |
| `auth.noAccount` | No account? | Login page |
| `auth.haveAccount` | Already have an account? | Register page |

## Extending it

**Add a copy key**: pick a `section.name` key, add a `useCopy(key, fallback)`
call where the string currently is hardcoded in `apps/platform`, and add a
row to `COPY_KEYS` in `apps/admin/app/branding/page.tsx` (and to the table
above). No backend change needed — `branding`'s copy store is a plain
key→string table, any key works.

**Add a font option**: add the font to `SupportedFont` in
`services/branding/Branding.Domain/Entities/Theme.cs`, generate an EF
migration (schema doesn't actually change — it's a string-converted enum —
but do it anyway for the model snapshot), load it via `next/font/google` in
`apps/platform/app/layout.tsx` following the existing pattern, add its CSS
variable to the `FONT_VAR` map in `context/branding-context.tsx`, and add it
to `SUPPORTED_FONTS` in `apps/admin/lib/api.ts`.
