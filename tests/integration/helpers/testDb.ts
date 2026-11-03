import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool as appPool } from '@/lib/db'
import { TEST_DB_NAME, TEST_DB_PORT } from './testDbConfig'

const schemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', 'db', 'schema.sql'
)

// This helper's own connection to the disposable test database. Separate from
// lib/db.ts's `pool` (which the route handlers use) so that a bug in the app's pool
// setup can't hide a bug in the test helper, or vice versa — see assertSafeToMutate().
export const testPool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
 * that DATABASE_URL looks right as a string (setup-env.ts already checked that), but
 * that the live connections really landed there.
 */
export async function assertSafeToMutate(): Promise<void> {
    const [testSide, appSide] = await Promise.all([
        identifyConnection(testPool),
        identifyConnection(appPool),
    ])

    for (const [label, conn] of [['test helper', testSide], ['app pool (lib/db.ts)', appSide]] as const) {
        if (conn.database !== TEST_DB_NAME || conn.port !== TEST_DB_PORT) {
            throw new Error(
                `Integration tests refuse to run: the ${label} connection is on ` +
                `database="${conn.database}" port=${conn.port}, expected ` +
                `database="${TEST_DB_NAME}" port=${TEST_DB_PORT}. Refusing to DROP/TRUNCATE ` +
                `anything until both the route's pool and the test helper's pool are ` +
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
