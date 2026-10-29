import 'server-only'
import {pool} from './db'
import type { SavedFindingInput } from './savedFinding'
import { randomUUID } from 'node:crypto'   //generates an ID and we generate for each scan and one for each finding. 

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