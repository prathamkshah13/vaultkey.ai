// Byte-level ceilings enforced before any JSON parsing happens — see
// readJsonBodyWithLimit.ts. These are coarse DoS backstops, not the precise business
// rules (e.g. POST /api/scans still enforces the exact 100,000-character code limit
// afterward); they just have to be generous enough that a legitimate request never
// trips them.

// JSON-encoding a 100,000-character string can expand it (quotes, escaping,
// multi-byte UTF-8, the "code" key and braces) — generously bounded well above the
// worst case (100,000 chars * 6 bytes/escape ~= 600,000) with headroom to spare.
export const MAX_SCAN_REQUEST_BODY_BYTES = 1_000_000

// { "reviewStatus": "resolved" } is on the order of 30 bytes. 1 KB leaves room for
// formatting/whitespace while still being clearly bounded.
export const MAX_REVIEW_STATUS_REQUEST_BODY_BYTES = 1_000
