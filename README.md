# Ravex

Ravex's marketing platform, structured as a small monorepo that can grow into separate product and service applications without burdening the first release.

## Run locally

```bash
cp apps/web/.env.example apps/web/.env.local
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The PostgreSQL container initializes the `inquiries` table automatically; every other table (auth, chat, usage) comes from `npm run db:migrate`.

To sign up and use the chat agent locally, also set `GEMINI_API_KEY` and `BETTER_AUTH_SECRET` in `apps/web/.env.local` — see `apps/web/.env.example`. Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Workspace layout

For the product implementation sequence and acceptance criteria, see the
[prediction product roadmap](docs/prediction-roadmap.md).

- `apps/web` — Next.js marketing site, inquiry API, and the authenticated chat agent
- `apps/platform` — the prediction-market product itself: Next.js + Tailwind, talks only to the gateway at `:5100` — see below
- `services` — prediction-market backend: `gateway` (YARP), `identity`, `wallet-ledger`, `market-catalog` (.NET 8, Clean Architecture) and `settlement-engine` (Go) — see `services/README.md`
- `infra/postgres` — local database bootstrap (the `inquiries` table for `apps/web`, plus per-service schemas for `services/*`)
- `packages` — reserved for shared contracts, UI and configuration as services are added

Run the backend services with `docker compose up -d --build` (see `services/README.md` for the golden-path walkthrough and ports), then run the product frontend natively — same pattern as `apps/web`, for proper hot-reload:

```bash
cp apps/platform/.env.example apps/platform/.env.local
npm run dev:platform
```

Open http://localhost:3001 (`apps/web` already owns :3000, so `platform` runs alongside it on :3001 rather than colliding). Register an account, then visit `/wallet` to earn free coins and `/` to create a market and place a stake — every action there is real: it debits your actual wallet balance through the gateway, not a mock.

## Database migrations

Schema lives in `apps/web/db/schema.ts`. After changing it:

```bash
npm run db:generate   # writes a new migration into apps/web/drizzle/
npm run db:migrate     # applies pending migrations to DATABASE_URL
```

## Production

Set `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY` and `GEMINI_MODEL_ID` in `apps/web/.env.local`. Run `npm run db:migrate`, then `npm run build`, then `npm run start --workspace=@ravex/web`.

The inquiry endpoint validates all input server-side and includes a honeypot field. The chat agent enforces a per-user daily token quota (`CHAT_DAILY_TOKEN_QUOTA`), but the `/api/auth/sign-up` and `/api/auth/sign-in` endpoints have no rate limiting yet — add infrastructure-level rate limiting across all of these before public launch.
