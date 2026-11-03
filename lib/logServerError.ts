import 'server-only'

// Error messages can contain request data or connection details.
export function logServerError(context: string, error: unknown): void {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined

    const sqlState = typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : undefined
    console.error(`[${context}]`, sqlState ? `Database failure (${sqlState})` : 'Database failure')
}
