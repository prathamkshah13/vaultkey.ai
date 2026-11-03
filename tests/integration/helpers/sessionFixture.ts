import type { TestContext } from 'node:test'
import { randomUUID } from 'node:crypto'
import { auth0 } from '@/lib/auth0'

export type FakeSession = { user: { sub: string } } | null

export function makeFakeUserSub(label: string): string {
    return `auth0|test-${label}-${randomUUID()}`
}

/**
 * Stubs auth0.getSession() for the duration of one test using node:test's built-in
 * mock tracker (t.mock), so it's auto-restored when the test ends — no real network
 * call to Auth0 is ever made, and no new test dependency is needed.
 *
 * Mocks the method exactly once per test and returns a setter, so a single test can
 * switch between "signed in as Alice" / "signed in as Bob" / "signed out" without
 * re-mocking the same method more than once.
 */
export function stubSession(t: TestContext): (session: FakeSession) => void {
    let current: FakeSession = null
    t.mock.method(auth0, 'getSession', async () => current)
    return (session: FakeSession) => {
        current = session
    }
}
