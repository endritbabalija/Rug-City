import 'server-only'
import { env } from './env'
import { store } from './store'

/** Every feature flag. Each ships off; see docs/phase-1/DEFAULTS.md. */
export type FlagName = 'season_banner' | 'solo' | 'dex_crew' | 'districts' | 'tutorial' | 'daily'

const CACHE_MS = 30_000

let cache: { at: number; flags: Promise<Record<string, boolean>> } | null = null

/**
 * Whether a feature is on. Reads the `feature_flags` table at most every 30 s per
 * instance; `FLAGS=a,b` forces flags on. Unknown flags, and a failed read, are off.
 */
export async function flag(name: FlagName): Promise<boolean> {
  if (env().forcedFlags.includes(name)) return true
  const now = Date.now()
  if (!cache || now - cache.at >= CACHE_MS) {
    const flags: Promise<Record<string, boolean>> = store()
      .getFlags()
      .catch((err) => {
        console.error('Reading feature flags failed', err)
        if (cache?.flags === flags) cache = null // try again on the next call
        return {}
      })
    cache = { at: now, flags }
  }
  return (await cache.flags)[name] === true
}

/** Tests only: forget the cached flags. */
export function resetFlagCache() {
  cache = null
}
