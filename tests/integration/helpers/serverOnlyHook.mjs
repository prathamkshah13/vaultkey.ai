// Node module customization hook (registered from setup-env.ts via node:module's
// register()), active only for this test process. Redirects the bare `server-only`
// specifier to serverOnlyShim.mjs so the real package's unconditional throw (meant for
// webpack-bundled client code) doesn't block loading app modules under plain Node.
// Everything else passes through to the normal resolver untouched.
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const shimUrl = pathToFileURL(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'serverOnlyShim.mjs')
).href

export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
        return { url: shimUrl, shortCircuit: true }
    }
    return nextResolve(specifier, context)
}
