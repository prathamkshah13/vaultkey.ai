import {auth0} from '@/lib/auth0'
import { pool } from '@/lib/db'
import scanForSecrets from '@/lib/scanner'
import { saveScan } from '@/lib/scanRepository'


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

    //Read the submitted body. So we parse the request body. Parse (Convert JSON text into JavaScript)

    let body: unknown
    try {
        body = await request.json()  //Read the body and prase its JSON
    } catch {
        return Response.json(
            { error: 'Invalid JSON'},
            { status: 400}

        )
    }

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