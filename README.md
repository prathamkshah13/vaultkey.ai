# VaultKey

VaultKey scans pasted code (or a local folder, from the CLI) for accidentally-committed API keys and tokens, masks anything it finds, and saves a history of those masked findings per signed-in user. Open a saved scan to review its findings and mark each one open, resolved, or ignored. The server uses your Auth0 session — never a client-supplied ID — to decide which records you can read or change. Pasted source and raw secrets are only ever held in memory for the duration of a scan; only the masked value is written to the database.

## Features

- **Secret scanning** — detects OpenAI, Anthropic, AWS, GitHub, Stripe, Slack, Google, and npm token shapes in pasted code (`lib/scanner.ts`, `lib/detector.ts`) and masks every match before it leaves memory (`lib/maskSecret.ts`).
- **Scan history, per user** — every scan (clean or not) is saved with its findings; a user only ever sees their own scans and findings, enforced in SQL, not just in the UI.
- **Finding review workflow** — mark a finding `open`, `resolved`, or `ignored` from its scan's detail page.
- **Optional risk explanations** — `POST /api/risk-score` asks Gemini for a short, provider-specific risk note (requires `GEMINI_API_KEY`; the app works fully without it).
- **CLI scanning** — `npm run scan -- <folder>` runs the same detectors over a local folder, skipping `node_modules`, `.git`, `.next`, `dist`, `out`, and `build`.

## Tech stack

Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Postgres via `pg` (no ORM, plain SQL in `db/schema.sql`), Auth0 (`@auth0/nextjs-auth0`) for sign-in and session, Tailwind CSS for styling. Tests run on Node's built-in test runner (`node:test`) via `tsx` — no Jest/Vitest.

## Project structure

```
app/
  page.tsx                  Landing page (sign in / scan / history links)
  scan/page.tsx              Paste code, scan it, save the result
  history/page.tsx           List of your saved scans
  history/[id]/page.tsx      One scan's findings + review-status controls
  api/scans/route.ts         GET (list) / POST (create) your scans
  api/scans/[id]/route.ts    GET one scan + its findings
  api/findings/[id]/route.ts PATCH a finding's review status
  api/risk-score/route.ts    POST — optional Gemini risk explanation
  cli/scan.ts                 Folder-scanning CLI (`npm run scan`)
lib/
  scanner.ts, detector.ts, maskSecret.ts   Secret detection + masking
  scanRepository.ts                        All scan/finding SQL
  auth0.ts, db.ts                          Auth0 client, Postgres pool
  readJsonBodyWithLimit.ts, requestBodyLimits.ts, logServerError.ts
                                            Request-size limits and safe error logging
db/schema.sql                Postgres schema (scan, finding tables)
tests/                       Unit tests (scanner, masking)
tests/integration/           Postgres-backed API tests (see Verify, below)
```

## API reference

All routes below require a signed-in Auth0 session; `401` otherwise. State-changing routes (`POST`, `PATCH`) also require the request's `Origin` header to match the app's own origin.

| Method & path | Body | Notes |
| --- | --- | --- |
| `GET /api/scans` | — | Lists the signed-in user's scans, newest first. |
| `POST /api/scans` | `{ "code": string }` (≤100,000 chars) | Scans and saves it; returns `{ scanId, findings }`. |
| `GET /api/scans/:id` | — | Returns `{ scan, findings }` for one scan. `404` if it doesn't exist *or* belongs to someone else — the two are indistinguishable by design. |
| `PATCH /api/findings/:id` | `{ "reviewStatus": "open" \| "resolved" \| "ignored" }` | Updates a finding's review status. Same `404`-for-both-cases rule as above. |
| `POST /api/risk-score` | `{ "provider": string }` | Optional; returns a short Gemini-generated risk note for that provider. |

Every read and write is scoped to `owner_id = <session user>` directly in the SQL (see `lib/scanRepository.ts`) — a request body or path parameter can never grant access to another user's data, because ownership is never read from either.

## Run locally

1. Install Node.js 20+ and npm. Install Postgres 17 (or use the Docker Compose file below for a disposable one). Run `npm ci`.
2. On a fresh application database, apply `db/schema.sql` with `psql` before starting the app.
3. Create an Auth0 Regular Web Application. For local development, allow callback `http://localhost:3000/auth/callback` and logout URL `http://localhost:3000`.
4. In an ignored `.env.local`, set `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, and `APP_BASE_URL` (`http://localhost:3000` locally, with a generated session secret). Optionally set `GEMINI_API_KEY` to enable risk explanations.
5. Run `npm run dev` and open [VaultKey](http://localhost:3000).

## Verify

Run `npm test`, `npm run lint`, and `npx tsc --noEmit`. For the real-Postgres integration tests (ownership, body-size limits, safe DB-failure responses — see `tests/integration/`), run these in a shell without an application `DATABASE_URL` override:

```sh
docker compose -f docker-compose.test.yml up -d --wait
npm run test:integration
docker compose -f docker-compose.test.yml down
```

CI (`.github/workflows/ci.yml`) runs `npm test` and the type check on every push and pull request; it does not run the Postgres-backed integration suite.

Use [the synthetic fixtures](TEST_ACCOUNTS_AND_SCANS.md) for browser checks. Sign in, save a scan, open its history entry, update a finding, and reload to confirm persistence. Use a separate browser session to check that a second account cannot read or update the first account's records.

## Security notes

- Ownership is enforced in the SQL `WHERE`/`JOIN` clause, not just in application logic — see `getScanWithFindings` and `updateFindingReviewStatus` in `lib/scanRepository.ts`.
- Request bodies are size-limited *before* `JSON.parse` runs (`lib/readJsonBodyWithLimit.ts`), so an oversized payload can't be used to exhaust memory or CPU during parsing.
- Database failures return a generic JSON error; only a short error code/message is logged server-side (`lib/logServerError.ts`) — never the request body, raw secrets, or `DATABASE_URL`.
- Raw pasted source and unmasked secret values are never written to the database — only `masked_value` is persisted.

## Deploy

Provision a hosted Postgres database and apply `db/schema.sql` once. Set the same environment variables in your Next.js host's secret settings. Use the deployed HTTPS origin for `APP_BASE_URL` and add its callback and logout URLs to Auth0. Run the browser checks above against the deployed app before sharing it.
