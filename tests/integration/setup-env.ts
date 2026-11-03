// Preloaded via `tsx --test --import ./tests/integration/setup-env.ts` so these env vars
// are in place BEFORE the test file (and anything it imports, like lib/db.ts and the route
// handlers) ever runs. lib/db.ts reads process.env.DATABASE_URL at module-load time, so
// setting it here first is what makes this work.
//
// Deliberately no shell-specific syntax (no `VAR=val cmd`): that breaks on Windows
// PowerShell. Everything needed to point the suite at the disposable test DB lives here,
// in plain cross-platform TypeScript.

import { register } from 'node:module'
import { DEFAULT_TEST_DATABASE_URL, assertIsDisposableTestDatabaseUrl } from './helpers/testDbConfig'

// Must run before anything imports lib/db.ts, lib/auth0.ts, or lib/scanRepository.ts —
// see serverOnlyHook.mjs for why the real `server-only` package can't load under plain
// Node. This does not change what those files import or how they guard themselves;
// it only changes what `server-only` resolves to inside this test process.
register('./helpers/serverOnlyHook.mjs', import.meta.url)

process.env.DATABASE_URL ??= DEFAULT_TEST_DATABASE_URL

// Fail closed: whether DATABASE_URL came from the default above or from the caller's
// environment, it must unambiguously be the disposable test database before any test
// (or lib/db.ts, or scanRepository.ts) can touch it.
assertIsDisposableTestDatabaseUrl(process.env.DATABASE_URL)

// @auth0/nextjs-auth0's Auth0Client may validate its config at construction time
// (lib/auth0.ts does `new Auth0Client({})` at import time). These are dummy, non-secret
// placeholder values for a client that is never actually used to talk to Auth0 in this
// suite — auth0.getSession() is stubbed per-test instead. Only set if not already present.
process.env.AUTH0_SECRET ??= 'integration-test-placeholder-not-a-real-secret'
process.env.APP_BASE_URL ??= 'http://localhost:3000'
process.env.AUTH0_DOMAIN ??= 'integration-test.example.com'
process.env.AUTH0_CLIENT_ID ??= 'integration-test-placeholder-client-id'
process.env.AUTH0_CLIENT_SECRET ??= 'integration-test-placeholder-client-secret'
