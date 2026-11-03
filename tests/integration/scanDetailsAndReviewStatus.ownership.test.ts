// Focused cross-user checks for the two new authenticated endpoints:
//   GET   /api/scans/[id]      (scan details + its masked findings)
//   PATCH /api/findings/[id]   (update a finding's review status)
//
// Same approach as scans.ownership.test.ts: real Postgres, mocked auth0.getSession(),
// the actual route handlers called directly.

import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { GET as getScanDetails } from '@/app/api/scans/[id]/route'
import { PATCH as patchFindingReviewStatus } from '@/app/api/findings/[id]/route'
import { POST as postScan } from '@/app/api/scans/route'
import { resetSchema, truncateAll, closeTestDb, closeAppDb, testPool } from './helpers/testDb'
import { stubSession, makeFakeUserSub, type FakeSession } from './helpers/sessionFixture'

// Matches the OpenAI-shaped pattern lib/scanner.ts already detects (see
// tests/scanner.test.ts), so saveScan() persists exactly one finding row.
const CODE_WITH_ONE_SECRET = 'sk-abcdefghijklmnopqrstuvwxyz1234567890'

function makePostScanRequest(code: string): Request {
    return new Request('http://localhost:3000/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ code }),
    })
}

function makeGetScanDetailsRequest(id: string): Request {
    return new Request(`http://localhost:3000/api/scans/${id}`)
}

function makePatchFindingRequest(id: string, body: unknown): Request {
    return new Request(`http://localhost:3000/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(body),
    })
}

async function createScanWithOneFinding(
    setSession: (session: FakeSession) => void,
    ownerSub: string
): Promise<{ scanId: string; findingId: string }> {
    setSession({ user: { sub: ownerSub } })
    const res = await postScan(makePostScanRequest(CODE_WITH_ONE_SECRET))
    assert.strictEqual(res.status, 201)
    const body = await res.json() as { scanId: string }

    const row = await testPool.query<{ id: string }>(
        'SELECT id FROM finding WHERE scan_id = $1',
        [body.scanId]
    )
    assert.strictEqual(row.rows.length, 1, 'expected exactly one finding to be persisted')
    return { scanId: body.scanId, findingId: row.rows[0].id }
}

before(async () => {
    await resetSchema()
})

beforeEach(async () => {
    await truncateAll()
})

after(async () => {
    await closeTestDb()
    await closeAppDb()
})

test('a user can read their own scan details, but not another user\'s', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const bobSub = makeFakeUserSub('bob')

    const { scanId, findingId } = await createScanWithOneFinding(setSession, aliceSub)

    setSession({ user: { sub: aliceSub } })
    const aliceRes = await getScanDetails(
        makeGetScanDetailsRequest(scanId),
        { params: Promise.resolve({ id: scanId }) }
    )
    assert.strictEqual(aliceRes.status, 200)
    const aliceBody = await aliceRes.json() as { scan: { id: string }; findings: Array<{ id: string }> }
    assert.strictEqual(aliceBody.scan.id, scanId)
    assert.ok(aliceBody.findings.some((f) => f.id === findingId), 'Alice should see her own finding')

    setSession({ user: { sub: bobSub } })
    const bobRes = await getScanDetails(
        makeGetScanDetailsRequest(scanId),
        { params: Promise.resolve({ id: scanId }) }
    )
    assert.strictEqual(bobRes.status, 404, "Bob reading Alice's scan ID must get the same response as a nonexistent scan")
})

test('a user can update their own finding\'s review status, but not another user\'s', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const bobSub = makeFakeUserSub('bob')

    const { findingId } = await createScanWithOneFinding(setSession, aliceSub)

    setSession({ user: { sub: bobSub } })
    const bobRes = await patchFindingReviewStatus(
        makePatchFindingRequest(findingId, { reviewStatus: 'resolved' }),
        { params: Promise.resolve({ id: findingId }) }
    )
    assert.strictEqual(bobRes.status, 404, "Bob updating Alice's finding must get the same response as a nonexistent finding")

    const afterBobsAttempt = await testPool.query<{ review_status: string }>(
        'SELECT review_status FROM finding WHERE id = $1',
        [findingId]
    )
    assert.strictEqual(
        afterBobsAttempt.rows[0].review_status,
        'open',
        "Bob's rejected request must not have changed Alice's finding"
    )

    setSession({ user: { sub: aliceSub } })
    const aliceRes = await patchFindingReviewStatus(
        makePatchFindingRequest(findingId, { reviewStatus: 'resolved' }),
        { params: Promise.resolve({ id: findingId }) }
    )
    assert.strictEqual(aliceRes.status, 200)
    const aliceBody = await aliceRes.json() as { finding: { id: string; review_status: string } }
    assert.strictEqual(aliceBody.finding.review_status, 'resolved')

    const afterAlicesUpdate = await testPool.query<{ review_status: string }>(
        'SELECT review_status FROM finding WHERE id = $1',
        [findingId]
    )
    assert.strictEqual(afterAlicesUpdate.rows[0].review_status, 'resolved')
})

test('a request body cannot grant access by supplying another owner\'s ID', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const bobSub = makeFakeUserSub('bob')

    const { findingId } = await createScanWithOneFinding(setSession, aliceSub)

    // Bob is signed in as himself, but tries to pass Alice's ID in the body, hoping
    // it's trusted instead of the session. The route never reads ownerId from the
    // body at all, so this has no effect — the query still runs with Bob's own
    // session sub, and the finding is Alice's, so it's still a 404.
    setSession({ user: { sub: bobSub } })
    const res = await patchFindingReviewStatus(
        makePatchFindingRequest(findingId, { reviewStatus: 'resolved', ownerId: aliceSub, owner_id: aliceSub }),
        { params: Promise.resolve({ id: findingId }) }
    )
    assert.strictEqual(res.status, 404)
})

test('rejects a reviewStatus value outside open/resolved/ignored', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const { findingId } = await createScanWithOneFinding(setSession, aliceSub)

    setSession({ user: { sub: aliceSub } })
    const res = await patchFindingReviewStatus(
        makePatchFindingRequest(findingId, { reviewStatus: 'archived' }),
        { params: Promise.resolve({ id: findingId }) }
    )
    assert.strictEqual(res.status, 400)

    const unchanged = await testPool.query<{ review_status: string }>(
        'SELECT review_status FROM finding WHERE id = $1',
        [findingId]
    )
    assert.strictEqual(unchanged.rows[0].review_status, 'open')
})

test('signed-out requests are rejected with 401 and change nothing', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const { scanId, findingId } = await createScanWithOneFinding(setSession, aliceSub)

    setSession(null)

    const getRes = await getScanDetails(
        makeGetScanDetailsRequest(scanId),
        { params: Promise.resolve({ id: scanId }) }
    )
    assert.strictEqual(getRes.status, 401)

    const patchRes = await patchFindingReviewStatus(
        makePatchFindingRequest(findingId, { reviewStatus: 'resolved' }),
        { params: Promise.resolve({ id: findingId }) }
    )
    assert.strictEqual(patchRes.status, 401)

    const unchanged = await testPool.query<{ review_status: string }>(
        'SELECT review_status FROM finding WHERE id = $1',
        [findingId]
    )
    assert.strictEqual(unchanged.rows[0].review_status, 'open')
})
