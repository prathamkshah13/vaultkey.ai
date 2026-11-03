// Enforces a byte limit on a request body BEFORE handing it to JSON.parse, so an
// oversized payload is rejected without ever being buffered in full or parsed.
// JSON.parse on an attacker-controlled multi-megabyte string is itself a cheap way to
// burn CPU/memory, so the size check has to happen first, not after request.json().

export type ReadJsonBodyResult =
    | { ok: true; body: unknown }
    | { ok: false; status: 413; error: 'Request body is too large' }
    | { ok: false; status: 400; error: 'Invalid JSON' }

export async function readJsonBodyWithLimit(
    request: Request,
    maxBytes: number
): Promise<ReadJsonBodyResult> {
    // Fast path: a declared Content-Length over the limit is rejected without
    // reading any of the body at all. This header can be absent or wrong (chunked
    // transfer-encoding, a lying client), so it's a cheap early-exit, not the real
    // enforcement — the streaming loop below is what actually guarantees the limit.
    const declaredLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        return { ok: false, status: 413, error: 'Request body is too large' }
    }

    if (!request.body) {
        return parseJson('')
    }

    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }
        totalBytes += value.byteLength
        if (totalBytes > maxBytes) {
            await reader.cancel()
            return { ok: false, status: 413, error: 'Request body is too large' }
        }
        chunks.push(value)
    }

    const combined = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.byteLength
    }

    return parseJson(new TextDecoder('utf-8').decode(combined))
}

function parseJson(text: string): ReadJsonBodyResult {
    try {
        return { ok: true, body: JSON.parse(text) }
    } catch {
        return { ok: false, status: 400, error: 'Invalid JSON' }
    }
}
