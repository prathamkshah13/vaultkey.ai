import { auth0 } from '@/lib/auth0'
import { updateFindingReviewStatus } from '@/lib/scanRepository'
import { isReviewStatus } from '@/lib/reviewStatus'
import { readJsonBodyWithLimit } from '@/lib/readJsonBodyWithLimit'
import { MAX_REVIEW_STATUS_REQUEST_BODY_BYTES } from '@/lib/requestBodyLimits'
import { logServerError } from '@/lib/logServerError'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth0.getSession()
    if (!session) {
        return Response.json(
            { error: 'You must sign in to update a finding' },
            { status: 401 }
        )
    }

    // Check where the request came from, same as POST /api/scans.
    const expectedOrigin = new URL(request.url).origin
    if (request.headers.get('origin') !== expectedOrigin) {
        return Response.json(
            { error: 'Request origin is not allowed' },
            { status: 403 }
        )
    }

    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return Response.json(
            { error: 'Send the request as JSON' },
            { status: 415 }
        )
    }

    // Size is enforced before any JSON parsing happens — see readJsonBodyWithLimit.ts.
    const parsedBody = await readJsonBodyWithLimit(request, MAX_REVIEW_STATUS_REQUEST_BODY_BYTES)
    if (!parsedBody.ok) {
        return Response.json(
            { error: parsedBody.error },
            { status: parsedBody.status }
        )
    }
    const body = parsedBody.body

    if (
        typeof body !== 'object' || body === null ||
        !('reviewStatus' in body) || !isReviewStatus(body.reviewStatus)
    ) {
        return Response.json(
            { error: 'Provide reviewStatus as one of: open, resolved, ignored' },
            { status: 400 }
        )
    }

    const { id } = await params
    const ownerId = session.user.sub

    let updated
    try {
        updated = await updateFindingReviewStatus(id, ownerId, body.reviewStatus)
    } catch (error) {
        logServerError('PATCH /api/findings/[id]', error)
        return Response.json(
            { error: 'Unable to update finding' },
            { status: 500 }
        )
    }

    // Same response whether the finding doesn't exist or its scan belongs to someone
    // else — a request body can't grant access by supplying a different owner's ID,
    // because the owner ID used in the query comes only from the session.
    if (!updated) {
        return Response.json(
            { error: 'Finding not found' },
            { status: 404 }
        )
    }

    return Response.json({ finding: updated })
}
