# Ravex

Ravex's marketing platform, structured as a small monorepo that can grow into separate product and service applications without burdening the first release.

## Run locally

```bash
cp apps/web/.env.example apps/web/.env.local
docker compose up -d
npm install
npm run dev
```

Open http://localhost:3000. The PostgreSQL container initializes the inquiry table automatically.

## Workspace layout

- `apps/web` — Next.js marketing site and inquiry API
- `infra/postgres` — local database bootstrap
- `packages` — reserved for shared contracts, UI and configuration as services are added

## Production

Set `DATABASE_URL` in `apps/web/.env.local` to a PostgreSQL-compatible connection string and `NEXT_PUBLIC_SITE_URL` to the canonical public URL. Run `npm run build`, then `npm run start --workspace=@ravex/web`.

The inquiry endpoint validates all input server-side and includes a honeypot field. Add infrastructure-level rate limiting before public launch.
