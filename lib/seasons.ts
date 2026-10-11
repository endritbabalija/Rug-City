import 'server-only'
import { seasonAt, type Season } from './game/progress'
import { store } from './store'

const CACHE_MS = 5 * 60_000

let cache: { at: number; seasons: Promise<Season[]> } | null = null

/** The `seasons` table, read at most every 5 minutes per instance. */
export function getSeasons(): Promise<Season[]> {
  const now = Date.now()
  if (!cache || now - cache.at >= CACHE_MS) {
    const seasons = store()
      .getSeasons()
      .catch((err) => {
        if (cache?.seasons === seasons) cache = null // try again on the next call
        throw err
      })
    cache = { at: now, seasons }
  }
  return cache.seasons
}

export async function currentSeason(now = Date.now()) {
  return seasonAt(now, await getSeasons())
}

/** Tests only: forget the cached seasons. */
export function resetSeasonCache() {
  cache = null
}
