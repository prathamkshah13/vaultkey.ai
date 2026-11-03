import { auth0 } from '@/lib/auth0'
import { getScanWithFindings } from '@/lib/scanRepository'
import { logServerError } from '@/lib/logServerError'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth0.getSession()
    if (!session) {
        return Response.json(
            { error: 'You must sign in to view this scan' },
            { status: 401 }
        )
    }

    const { id } = await params
    const ownerId = session.user.sub

    let result
    try {
        result = await getScanWithFindings(id, ownerId)
    } catch (error) {
        logServerError('GET /api/scans/[id]', error)
        return Response.json(
            { error: 'Unable to load scan' },
            { status: 500 }
        )
    }

    // Same response whether the scan doesn't exist or belongs to someone else — the
    // caller has no way to tell "not found" apart from "not yours".
    if (!result) {
        return Response.json(
            { error: 'Scan not found' },
            { status: 404 }
        )
    }

    return Response.json(result)
}
