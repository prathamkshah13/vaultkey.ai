# VaultKey

VaultKey scans pasted code for potential secrets and saves a history of masked findings. Sign in to scan, open a saved scan, and mark findings open, resolved, or ignored. The server uses your Auth0 session to decide which records you can access. Pasted source and raw secrets are processed transiently and are not stored in scan history.

## Run locally

1. Install Node.js 20 or newer, npm, and Postgres 17. Run `npm ci`.
2. On a fresh application database, apply `db/schema.sql` with `psql` before starting the app.
3. Create an Auth0 Regular Web Application. For local development, allow callback `http://localhost:3000/auth/callback` and logout URL `http://localhost:3000`.
4. Set `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, and `APP_BASE_URL` in your ignored `.env.local`. Use `http://localhost:3000` for the local base URL and a generated session secret.
5. Run `npm run dev` and open [VaultKey](http://localhost:3000).

## Verify

Run `npm test`, `npm run lint`, and `npx tsc --noEmit`. For real Postgres integration tests, run these in a shell without an application DATABASE_URL override:

```sh
docker compose -f docker-compose.test.yml up -d --wait
npm run test:integration
docker compose -f docker-compose.test.yml down
```

Use [the synthetic fixtures](TEST_ACCOUNTS_AND_SCANS.md) for browser checks. Sign in, save a scan, open its history entry, update a finding, and reload to confirm persistence. Use a separate browser session to check that a second account cannot read or update the first account's records.

## Deploy

Provision a hosted Postgres database and apply the schema once. Set the same environment variables in your Next.js host's secret settings. Use the deployed HTTPS origin for APP_BASE_URL and add its callback and logout URLs to Auth0. Run the browser checks against the deployed app before sharing it.
