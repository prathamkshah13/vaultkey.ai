import {auth0} from '@/lib/auth0'
import { pool } from '@/lib/db'

export async function GET(){
    const session = await auth0.getSession()
    if (!session){
        return Response.json(
            { error : 'you must sign it to view scans'},
            {status: 401}
        )
    }

    const ownerId = session.user.sub

    const result = await pool.query(
        'SELECT id, created_at FROM scan WHERE owner_id = $1 ORDER BY created_at DESC',
        [ownerId]
    )

    return Response.json(
        {scans: result.rows}
    )
}