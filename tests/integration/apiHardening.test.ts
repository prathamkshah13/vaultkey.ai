// Focused checks for two v1 hardening changes:
//   1. Oversized request bodies are rejected before JSON.parse ever runs, on both
//      scan creation (POST /api/scans) and review-status updates
//      (PATCH /api/findings/[id]).
//   2. A database failure in scan listing, scan detail, or review-status update
//      comes back as a safe, generic JSON error — never the raw driver error.
//
// Deliberately does NOT need a live Postgres: the oversized-body checks are rejected
// before any DB call is made, and the DB-failure checks replace pool.query with a
// mock that throws, so no real connection is ever attempted. auth0.getSession() is
// stubbed the same way the other integration suites do it.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { pool } from '@/lib/db'
import { GET as listScans, POST as createScan } from '@/app/api/scans/route'
import { GET as getScanDetails } from '@/app/api/scans/[id]/route'
import { PATCH as patchFindingReviewStatus } from '@/app/api/findings/[id]/route'
import { MAX_SCAN_REQUEST_BODY_BYTES, MAX_REVIEW_STATUS_REQUEST_BODY_BYTES } from '@/lib/requestBodyLimits'
import { stubSession, makeFakeUserSub } from './helpers/sessionFixture'

function makeOversizedScanCreateRequest(): Request {
    // Not valid JSON either — if the oversized payload were accidentally handed to
    // JSON.parse first, it would fail with a 400 (Invalid JSON), not a 413. Getting
    // 413 here proves the size check ran before any parsing was attempted.
    const garbage = 'x'.repeat(MAX_SCAN_REQUEST_BODY_BYTES + 1_000)
    return new Request('http://localhost:3000/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: garbage,
    })
}

function makeOversizedReviewStatusRequest(id: string): Request {
    const garbage = 'x'.repeat(MAX_REVIEW_STATUS_REQUEST_BODY_BYTES + 1_000)
    return new Request(`http://localhost:3000/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: garbage,
    })
}

function makeWellFormedReviewStatusRequest(id: string): Request {
    return new Request(`http://localhost:3000/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ reviewStatus: 'resolved' }),
    })
}

const SIMULATED_DB_FAILURE_MESSAGE = 'simulated database failure for this test only'

after(async () => {
    await pool.end()
})

test('rejects an oversized scan-creation body before parsing JSON', async (t) => {
    const setSession = stubSession(t)
    setSession({ user: { sub: makeFakeUserSub('alice') } })

    const res = await createScan(makeOversizedScanCreateRequest())
    assert.strictEqual(res.status, 413)
    const body = await res.json() as { error: string }
    assert.match(body.error, /too large/i)
})

test('rejects an oversized review-status update body before parsing JSON', async (t) => {
    const setSession = stubSession(t)
    setSession({ user: { sub: makeFakeUserSub('alice') } })

    const res = await patchFindingReviewStatus(
        makeOversizedReviewStatusRequest('some-finding-id'),
        { params: Promise.resolve({ id: 'some-finding-id' }) }
    )
    assert.strictEqual(res.status, 413)
    const body = await res.json() as { error: string }
    assert.match(body.error, /too large/i)
})

test('returns a safe JSON error when scan listing\'s database query fails', async (t) => {
    const setSession = stubSession(t)
    setSession({ user: { sub: makeFakeUserSub('alice') } })
    t.mock.method(pool, 'query', async () => {
        throw new Error(SIMULATED_DB_FAILURE_MESSAGE)
    })

    const res = await listScans()
    assert.strictEqual(res.status, 500)
    const rawBody = await res.text()
    assert.doesNotMatch(rawBody, new RegExp(SIMULATED_DB_FAILURE_MESSAGE))
    const body = JSON.parse(rawBody) as { error: string }
    assert.strictEqual(typeof body.error, 'string')
    assert.ok(body.error.length > 0)
})

test('returns a safe JSON error when scan detail\'s database query fails', async (t) => {
    const setSession = stubSession(t)
    setSession({ user: { sub: makeFakeUserSub('alice') } })
    t.mock.method(pool, 'query', async () => {
        throw new Error(SIMULATED_DB_FAILURE_MESSAGE)
    })

    const res = await getScanDetails(
        new Request('http://localhost:3000/api/scans/some-scan-id'),
        { params: Promise.resolve({ id: 'some-scan-id' }) }
    )
    assert.strictEqual(res.status, 500)
    const rawBody = await res.text()
    assert.doesNotMatch(rawBody, new RegExp(SIMULATED_DB_FAILURE_MESSAGE))
    const body = JSON.parse(rawBody) as { error: string }
    assert.strictEqual(typeof body.error, 'string')
    assert.ok(body.error.length > 0)
})

test('returns a safe JSON error when a review-status update\'s database query fails', async (t) => {
    const setSession = stubSession(t)
    setSession({ user: { sub: makeFakeUserSub('alice') } })
    t.mock.method(pool, 'query', async () => {
        throw new Error(SIMULATED_DB_FAILURE_MESSAGE)
    })

    const res = await patchFindingReviewStatus(
        makeWellFormedReviewStatusRequest('some-finding-id'),
        { params: Promise.resolve({ id: 'some-finding-id' }) }
    )
    assert.strictEqual(res.status, 500)
    const rawBody = await res.text()
    assert.doesNotMatch(rawBody, new RegExp(SIMULATED_DB_FAILURE_MESSAGE))
    const body = JSON.parse(rawBody) as { error: string }
    assert.strictEqual(typeof body.error, 'string')
    assert.ok(body.error.length > 0)
})
