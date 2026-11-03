import { auth0 } from '@/lib/auth0'
import { getScanWithFindings } from '@/lib/scanRepository'

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

    const result = await getScanWithFindings(id, ownerId)

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
