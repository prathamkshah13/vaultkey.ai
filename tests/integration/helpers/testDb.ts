import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool as appPool } from '@/lib/db'
import { TEST_DB_NAME, TEST_DB_INTERNAL_PORT, parseValidatedTestConnection } from './testDbConfig'

const schemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', 'db', 'schema.sql'
)

// Re-validated here, immediately before this pool is built: setup-env.ts (preloaded via
// `--import`) already validated process.env.DATABASE_URL before the test file — and
// therefore both lib/db.ts and this module — were ever imported, so this is defense in
// depth at the exact construction site, not the only gate.
const validatedConnection = parseValidatedTestConnection(process.env.DATABASE_URL)

// This helper's own connection to the disposable test database, built from the
// validated discrete fields above — never `connectionString` — and with SSL off. That
// way nothing evaluated after the check above (a PG* environment variable, a query
// parameter, any other merged config option) can change what this pool actually
// connects to. Separate from lib/db.ts's `pool` (which the route handlers use) so a bug
// in one pool's setup can't hide a bug in the other's — see assertSafeToMutate().
export const testPool = new Pool({
    host: validatedConnection.host,
    port: validatedConnection.port,
    database: validatedConnection.database,
    user: validatedConnection.user,
    password: validatedConnection.password,
    ssl: false,
    max: 5,
    connectionTimeoutMillis: 5000,
})

async function identifyConnection(pool: Pool): Promise<{ database: string; port: number }> {
    const result = await pool.query<{ database: string; port: number }>(
        'SELECT current_database() AS database, inet_server_port() AS port'
    )
    return result.rows[0]
}

/**
 * Fail closed before any destructive statement: confirms that BOTH this test helper's
 * pool and the application's own pool (lib/db.ts, the one route.ts/scanRepository.ts
 * actually use) are connected to the dedicated disposable test database — not merely
 * that DATABASE_URL looks right as a string (parseValidatedTestConnection already
 * checked that), but that the live connections really landed there.
 *
 * inet_server_port() reports the port Postgres itself is listening on INSIDE the
 * container — 5432 — not the host-mapped port (5433) a client dials to reach it via
 * docker-compose.test.yml's "127.0.0.1:5433:5432". Comparing against 5433 here would
 * never pass, even against the correct, healthy disposable database.
 */
export async function assertSafeToMutate(): Promise<void> {
    const [testSide, appSide] = await Promise.all([
        identifyConnection(testPool),
        identifyConnection(appPool),
    ])

    for (const [label, conn] of [['test helper', testSide], ['app pool (lib/db.ts)', appSide]] as const) {
        if (conn.database !== TEST_DB_NAME || conn.port !== TEST_DB_INTERNAL_PORT) {
            throw new Error(
                `Integration tests refuse to run: the ${label} connection reports ` +
                `database="${conn.database}" port=${conn.port}, expected ` +
                `database="${TEST_DB_NAME}" port=${TEST_DB_INTERNAL_PORT} (Postgres's own ` +
                `internal listening port inside the container — docker-compose.test.yml maps ` +
                `host port 5433 to it). Refusing to DROP/TRUNCATE anything until both pools are ` +
                `unambiguously talking to the disposable test database.`
            )
        }
    }
}

export async function resetSchema(): Promise<void> {
    await assertSafeToMutate()
    const schemaSql = readFileSync(schemaPath, 'utf8')
    await testPool.query('DROP TABLE IF EXISTS finding, scan CASCADE')
    await testPool.query(schemaSql)
}

export async function truncateAll(): Promise<void> {
    await assertSafeToMutate()
    await testPool.query('TRUNCATE finding, scan RESTART IDENTITY CASCADE')
}

export async function countScans(): Promise<number> {
    const result = await testPool.query<{ count: number }>('SELECT count(*)::int AS count FROM scan')
    return result.rows[0].count
}

export async function closeTestDb(): Promise<void> {
    await testPool.end()
}

export async function closeAppDb(): Promise<void> {
    await appPool.end()
}
