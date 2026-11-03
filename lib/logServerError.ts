import 'server-only'

// Logs only a short, safe summary of a server-side failure for operators — never the
// request body (which can be pasted source code), a raw secret, or a connection
// string. Only an Error's .message and, if present, a short .code (e.g. Postgres's
// '23505') are read off the error; the full error object is never passed to
// console.error, since some error subclasses attach extra context to it.
export function logServerError(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined

    console.error(`[${context}]`, code ? `${code}: ${message}` : message)
}
