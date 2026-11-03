// Integration suite against a real, disposable Postgres 17 (docker-compose.test.yml).
// Run with: npm run test:integration (see README section / plan for exact commands).
//
// No application code is modified or bypassed here: GET/POST are the real exports of
// app/api/scans/route.ts, called the same way Next.js's Route Handler runtime would call
// them (plain Web Request in, Response out — see node_modules/next/dist/docs/01-app/
// 01-getting-started/15-route-handlers.md). Only auth0.getSession() is stubbed, so every
// assertion below is exercising the real DB queries and the real ownership/401 guards.

import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { GET, POST } from '@/app/api/scans/route'
import { resetSchema, truncateAll, countScans, closeTestDb, closeAppDb, testPool } from './helpers/testDb'
import { stubSession, makeFakeUserSub } from './helpers/sessionFixture'

function makePostRequest(body: unknown, origin = 'http://localhost:3000'): Request {
    return new Request('http://localhost:3000/api/scans', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin,
        },
        body: JSON.stringify(body),
    })
}

type ScanListEntry = { id: string }

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

test('Alice and Bob each see only their own scans', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const bobSub = makeFakeUserSub('bob')

    setSession({ user: { sub: aliceSub } })
    const aliceCreateRes = await POST(makePostRequest({ code: 'const aliceMarker = 1' }))
    assert.strictEqual(aliceCreateRes.status, 201)
    const aliceCreated = await aliceCreateRes.json() as { scanId: string }

    setSession({ user: { sub: bobSub } })
    const bobCreateRes = await POST(makePostRequest({ code: 'const bobMarker = 1' }))
    assert.strictEqual(bobCreateRes.status, 201)
    const bobCreated = await bobCreateRes.json() as { scanId: string }

    setSession({ user: { sub: aliceSub } })
    const aliceListRes = await GET()
    assert.strictEqual(aliceListRes.status, 200)
    const aliceList = (await aliceListRes.json() as { scans: ScanListEntry[] }).scans
    const aliceIds = aliceList.map((s) => s.id)
    assert.ok(aliceIds.includes(aliceCreated.scanId), 'Alice should see her own scan')
    assert.ok(!aliceIds.includes(bobCreated.scanId), "Alice must not see Bob's scan")

    setSession({ user: { sub: bobSub } })
    const bobListRes = await GET()
    assert.strictEqual(bobListRes.status, 200)
    const bobList = (await bobListRes.json() as { scans: ScanListEntry[] }).scans
    const bobIds = bobList.map((s) => s.id)
    assert.ok(bobIds.includes(bobCreated.scanId), 'Bob should see his own scan')
    assert.ok(!bobIds.includes(aliceCreated.scanId), "Bob must not see Alice's scan")
})

test('a request body cannot override the signed-in owner', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    const bobSub = makeFakeUserSub('bob')

    setSession({ user: { sub: aliceSub } })
    const res = await POST(makePostRequest({
        code: 'const noSecretsHere = true',
        ownerId: bobSub,
        owner_id: bobSub,
    }))
    assert.strictEqual(res.status, 201)
    const created = await res.json() as { scanId: string }

    const dbRow = await testPool.query<{ owner_id: string }>(
        'SELECT owner_id FROM scan WHERE id = $1',
        [created.scanId]
    )
    assert.strictEqual(dbRow.rows.length, 1)
    assert.strictEqual(
        dbRow.rows[0].owner_id,
        aliceSub,
        'the persisted owner must be the signed-in session user, not the body-supplied id'
    )

    setSession({ user: { sub: bobSub } })
    const bobListRes = await GET()
    const bobIds = (await bobListRes.json() as { scans: ScanListEntry[] }).scans.map((s) => s.id)
    assert.ok(!bobIds.includes(created.scanId), 'the scan must not show up under the spoofed owner')
})

test('signed-out requests return 401 and add no scan row', async (t) => {
    const setSession = stubSession(t)
    setSession(null)

    const before = await countScans()

    const getRes = await GET()
    assert.strictEqual(getRes.status, 401)

    const postRes = await POST(makePostRequest({ code: 'const wellFormed = true' }))
    assert.strictEqual(postRes.status, 401)

    const after = await countScans()
    // This proves no scan row was added by either signed-out request — it does not by
    // itself prove zero database calls were made.
    assert.strictEqual(after, before, 'no scan row should have been added while signed out')
})

test('a clean scan persists with zero findings', async (t) => {
    const setSession = stubSession(t)
    const aliceSub = makeFakeUserSub('alice')
    setSession({ user: { sub: aliceSub } })

    const res = await POST(makePostRequest({ code: 'const x = 1;\nconst y = 2;' }))
    assert.strictEqual(res.status, 201)
    const body = await res.json() as { scanId: string; findings: unknown[] }
    assert.deepStrictEqual(body.findings, [])

    const scanRow = await testPool.query('SELECT id FROM scan WHERE id = $1', [body.scanId])
    assert.strictEqual(scanRow.rows.length, 1, 'the clean scan must still persist a scan row')

    const findingCount = await testPool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM finding WHERE scan_id = $1',
        [body.scanId]
    )
    assert.strictEqual(findingCount.rows[0].count, 0)
})
