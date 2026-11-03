// Loaded in place of the real `server-only` package only inside this integration test
// process (see serverOnlyHook.mjs). The real package unconditionally throws on import
// under plain Node — it relies on Next.js's webpack config aliasing it away for
// server-side bundles, which only happens inside `next dev`/`next build`, not here.
// This shim is a no-op so lib/db.ts, lib/auth0.ts, and lib/scanRepository.ts can be
// imported unmodified, with their `import 'server-only'` guard line left exactly as-is.
export {}
