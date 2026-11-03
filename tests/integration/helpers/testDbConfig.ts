// Shared constants for the disposable integration-test Postgres (docker-compose.test.yml).
// Both the env-setup module and the DB safety checks import from here, so there is exactly
// one place that defines what "the dedicated disposable test database" means.

export const TEST_DB_HOST = '127.0.0.1' // loopback only — must match docker-compose.test.yml's "127.0.0.1:5433:5432" binding
export const TEST_DB_EXTERNAL_PORT = 5433 // the host-side port a client dials
export const TEST_DB_INTERNAL_PORT = 5432 // the port Postgres itself reports via inet_server_port() INSIDE the container — Docker maps host 5433 to this, it is not 5433 from the server's own point of view
export const TEST_DB_USER = 'vaultkey_test'
export const TEST_DB_PASSWORD = 'vaultkey_test'
export const TEST_DB_NAME = 'vaultkey_test_disposable'

export const DEFAULT_TEST_DATABASE_URL =
    `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_EXTERNAL_PORT}/${TEST_DB_NAME}`

export interface ValidatedTestConnection {
    host: string
    port: number
    database: string
    user: string
    password: string
}

/**
 * Parses and validates a DATABASE_URL for the disposable integration-test database.
 * Fails closed (throws) unless the URL unambiguously targets:
 *   - the loopback host (127.0.0.1),
 *   - the external, host-mapped port (5433),
 *   - the disposable test database name,
 *   - an explicit user and password (so pg's PGUSER/PGPASSWORD environment-variable
 *     fallback never has an empty field to fill in),
 * and carries no query string at all — Postgres connection URIs support query
 * parameters (e.g. `?host=...`) that can override the host/socket a driver actually
 * connects to even when the authority section looks correct, so any query string is
 * rejected outright as "a connection option that could change the target".
 *
 * Returns the validated fields as discrete values, never a connection string: callers
 * should build `new Pool({...})` directly from these fields instead of passing
 * `connectionString`, so nothing evaluated after this check (an ambient PG* env var, a
 * query parameter, a merged config option) can change where the pool actually connects.
 *
 * The thrown error never includes the raw URL, user, or password — only the safe,
 * already-public constants (expected host/port/database name) and, where useful, the
 * actual host/port/database-name values supplied (never credentials).
 */
export function parseValidatedTestConnection(url: string | undefined): ValidatedTestConnection {
    if (!url) {
        throw new Error(
            'Integration tests refuse to run: DATABASE_URL is not set. ' +
            `Expected it to target the disposable test database "${TEST_DB_NAME}" ` +
            `at ${TEST_DB_HOST}:${TEST_DB_EXTERNAL_PORT} (see docker-compose.test.yml).`
        )
    }

    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new Error(
            'Integration tests refuse to run: DATABASE_URL is not a valid connection URL ' +
            '(details withheld — it may contain credentials).'
        )
    }

    const host = parsed.hostname
    const port = parsed.port
    const database = parsed.pathname.replace(/^\//, '')
    const user = decodeURIComponent(parsed.username)
    const password = decodeURIComponent(parsed.password)

    const problems: string[] = []
    if (host !== TEST_DB_HOST) {
        problems.push(`host must be the loopback address "${TEST_DB_HOST}" (got "${host}")`)
    }
    if (port !== String(TEST_DB_EXTERNAL_PORT)) {
        problems.push(`port must be the external/host-mapped port ${TEST_DB_EXTERNAL_PORT} (got "${port || '(none)'}")`)
    }
    if (database !== TEST_DB_NAME) {
        problems.push(`database must be "${TEST_DB_NAME}" (got "${database || '(none)'}")`)
    }
    if (!user) {
        problems.push('a user must be present in the URL (no PGUSER environment-variable fallback is allowed)')
    }
    if (!password) {
        problems.push('a password must be present in the URL (no PGPASSWORD environment-variable fallback is allowed)')
    }
    if (parsed.search.length > 0) {
        problems.push('query parameters are not allowed (they can override the connection target, e.g. "?host=...")')
    }

    if (problems.length > 0) {
        throw new Error(
            'Integration tests refuse to run: DATABASE_URL does not unambiguously target the ' +
            `disposable test database. ${problems.join('; ')}. ` +
            '(Credentials and the full URL are intentionally omitted from this message.)'
        )
    }

    return { host, port: TEST_DB_EXTERNAL_PORT, database, user, password }
}

/**
 * Thin, name-only wrapper around parseValidatedTestConnection for call sites (like
 * setup-env.ts) that only need the fail-closed check, not the parsed fields.
 */
export function assertIsDisposableTestDatabaseUrl(url: string | undefined): void {
    parseValidatedTestConnection(url)
}
