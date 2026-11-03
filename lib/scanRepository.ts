import 'server-only'
import {pool} from './db'
import type { SavedFindingInput } from './savedFinding'
import type { ReviewStatus } from './reviewStatus'
import { randomUUID } from 'node:crypto'   //generates an ID and we generate for each scan and one for each finding.

export interface SavedScanRow {
    id: string
    created_at: string
}

export interface SavedFindingRow {
    id: string
    provider: string
    masked_value: string
    severity: string
    line_number: number
    review_status: string
}

// We are in this saving the users scan together with its id. 
// 1st we need one database connection reserved for this operation

// We are reserving one connection because : Postgres tracks a transaction on a particular connection. 
// The scan insert and every finding insert must use that same connection to succeed or roll back together.

export async function saveScan(   // receives whose scan this is and the list of findings
    ownerId : string,
    findings: SavedFindingInput[]
) {
    const scanId = randomUUID()
    const client  = await pool.connect()  // pool.connect() borrows one connection from the pool.  naming it client
    let discardConnection = false

    try {
        //transaction instructions here 
        await client.query('BEGIN')

        await client.query (
            'INSERT INTO scan (id, owner_id) VALUES ($1, $2)',
            [scanId, ownerId]
        )

        for (const finding of findings){
            await client.query(
                'INSERT INTO finding (id, scan_id, provider, masked_value, severity, line_number ) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    randomUUID(),
                    scanId,
                    finding.provider,
                    finding.maskedValue,
                    finding.severity,
                    finding.lineNumber,
                ]
            )
        }
        await client.query('COMMIT')
        return scanId
    } catch (error){
        try {
            await client.query('ROLLBACK')
        } catch {
            discardConnection = true
        }
        throw error
    }
    finally {
        client.release(discardConnection)  //returns the borrowed connection to the pool for another request to use.
    }
}

// Reads one scan together with its findings, scoped to the signed-in owner.
// The `AND owner_id = $2` here is the entire access-control check: if the scan exists
// but belongs to someone else, this returns no row and the caller gets back null —
// the same response as "no such scan" — rather than ever touching the finding table.
export async function getScanWithFindings(
    scanId: string,
    ownerId: string
): Promise<{ scan: SavedScanRow; findings: SavedFindingRow[] } | null> {
    const scanResult = await pool.query<SavedScanRow>(
        'SELECT id, created_at FROM scan WHERE id = $1 AND owner_id = $2',
        [scanId, ownerId]
    )

    const scan = scanResult.rows[0]
    if (!scan) {
        return null
    }

    const findingsResult = await pool.query<SavedFindingRow>(
        'SELECT id, provider, masked_value, severity, line_number, review_status FROM finding WHERE scan_id = $1 ORDER BY line_number ASC',
        [scanId]
    )

    return { scan, findings: findingsResult.rows }
}

// Updates a finding's review status, scoped to the signed-in owner of the scan it
// belongs to. The join to `scan` and the `scan.owner_id = $3` clause are what make
// this ownership-safe: a finding ID belonging to another user's scan matches zero
// rows and the UPDATE is a no-op, regardless of what the caller asked for.
export async function updateFindingReviewStatus(
    findingId: string,
    ownerId: string,
    reviewStatus: ReviewStatus
): Promise<{ id: string; review_status: string } | null> {
    const result = await pool.query<{ id: string; review_status: string }>(
        `UPDATE finding
         SET review_status = $1
         FROM scan
         WHERE finding.id = $2
           AND finding.scan_id = scan.id
           AND scan.owner_id = $3
         RETURNING finding.id, finding.review_status`,
        [reviewStatus, findingId, ownerId]
    )

    return result.rows[0] ?? null
}