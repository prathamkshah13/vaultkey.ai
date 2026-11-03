// Shared constants for the disposable integration-test Postgres (docker-compose.test.yml).
// Both the env-setup module and the DB safety checks import from here, so there is exactly
// one place that defines what "the dedicated disposable test database" means.

export const TEST_DB_HOST = '127.0.0.1'
export const TEST_DB_PORT = 5433
export const TEST_DB_USER = 'vaultkey_test'
export const TEST_DB_PASSWORD = 'vaultkey_test'
export const TEST_DB_NAME = 'vaultkey_test_disposable'

export const DEFAULT_TEST_DATABASE_URL =
    `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${TEST_DB_NAME}`

/**
 * Fail closed: throws unless `url` unambiguously points at the disposable test database
 * (right database name, right port). This runs before any DROP/TRUNCATE/write so a
 * misconfigured DATABASE_URL aborts the suite instead of touching the wrong database.
 */
export function assertIsDisposableTestDatabaseUrl(url: string): void {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new Error(
            `Integration tests refuse to run: DATABASE_URL ("${url}") is not a valid URL.`
        )
    }

    const dbName = parsed.pathname.replace(/^\//, '')
    const port = parsed.port || '5432'

    if (dbName !== TEST_DB_NAME || port !== String(TEST_DB_PORT)) {
        throw new Error(
            `Integration tests refuse to run against DATABASE_URL="${url}". ` +
            `Expected the disposable test database "${TEST_DB_NAME}" on port ${TEST_DB_PORT} ` +
            `(see docker-compose.test.yml). This check exists so the suite can never ` +
            `accidentally DROP/TRUNCATE a non-test database.`
        )
    }
}
