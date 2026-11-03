import {auth0} from '@/lib/auth0'
import { pool } from '@/lib/db'
import scanForSecrets from '@/lib/scanner'
import { saveScan } from '@/lib/scanRepository'
import { readJsonBodyWithLimit } from '@/lib/readJsonBodyWithLimit'
import { MAX_SCAN_REQUEST_BODY_BYTES } from '@/lib/requestBodyLimits'
import { logServerError } from '@/lib/logServerError'


export async function GET(){
    const session = await auth0.getSession()
    if (!session){
        return Response.json(
            { error : 'you must sign it to view scans'},
            {status: 401}
        )
    }

    const ownerId = session.user.sub

    let result
    try {
        result = await pool.query(
            'SELECT id, created_at FROM scan WHERE owner_id = $1 ORDER BY created_at DESC',
            [ownerId]
        )
    } catch (error) {
        logServerError('GET /api/scans', error)
        return Response.json(
            { error: 'Unable to load scans' },
            { status: 500 }
        )
    }

    return Response.json(
        {scans: result.rows}
    )
}

export async function POST(request: Request){
    // Identifying the user
    const session = await auth0.getSession()
    if (!session){
        return Response.json(
            { error: 'You must sign in to save scan'},
            { status: 401}

        )
    }

    // Check the request : Check where the request came from 
    const expectedOrigin = new URL(request.url).origin  //This is our endpoints URL in this case : https://localhost:3000/

    if(request.headers.get('origin') !== expectedOrigin){
        return Response.json(
            {error: 'Request origin is not allowed'},
            {status: 403}
        )
    }

    // Check the request format. We expect the browser to send code inside the JSON. The requests content-type header declares its body format. 
    const contentType = request.headers.get('content-type')?? ''
    if(contentType.split(';')[0].trim().toLowerCase() !== 'application/json'){
        return Response.json(
            {error: 'Send the request as JSON'},
            { status: 415 }

        )
    }

    //Read the submitted body. Size is enforced before any JSON parsing happens —
    // see readJsonBodyWithLimit.ts — so an oversized payload never reaches JSON.parse.
    const parsedBody = await readJsonBodyWithLimit(request, MAX_SCAN_REQUEST_BODY_BYTES)
    if (!parsedBody.ok) {
        return Response.json(
            { error: parsedBody.error },
            { status: parsedBody.status }
        )
    }
    const body = parsedBody.body

    if (
        typeof body !== 'object' || body === null || !('code' in body) || typeof body.code !== 'string'
    ){
        return Response.json(
        { error: 'Provide code as a string' },
        { status: 400 }
        )
    }

    if (body.code.length > 100_000){
        return Response.json(
            { error: 'Code exceeds the 100,000-character limit' },
            { status: 413 }
        )
    }

    try {
        const findings = scanForSecrets(body.code)
        const scanId = await saveScan(session.user.sub, findings)

        return Response.json (
            {scanId, findings},
            {status: 201}
        )
    }
    catch{
        return Response.json(
            {error : 'Unable to save the scan' },
            {status : 500}
        )
    }
}