import 'server-only'
import { applyGrant, type Player } from './player'
import { seasonBadge } from './catalog'
import { ELITE_SHARE, seasonBounds, seasonOf, TOP_PRIZE_COUNT } from './game/progress'
import { store } from './store'

export const LEADERBOARD_SIZE = 50
/** Winners are read this many rows at a time and rewarded this many at once. */
const PAGE = 500
const BATCH = 20
/** Case credits for each top-10 finisher. */
export const TOP_PRIZE_CASES = 5

export async function leaderboard(player: Player, season = seasonOf(Date.now())) {
  const [{ rows, total }, position] = await Promise.all([
    store().getSeasonLeaderboard(season, LEADERBOARD_SIZE),
    store().getSeasonPosition(season, player.id),
  ])
  return {
    season,
    ...seasonBounds(season),
    total,
    me: position,
    // Telegram user ids stay on the server; the client only learns which row is its own.
    rows: rows.map((r, i) => ({ position: i + 1, me: r.playerId === player.id, name: r.name, badge: r.badge ?? null, rating: r.rating, cases: r.cases })),
  }
}

/**
 * End-of-season rewards, granted by an admin once the season is over:
 * top 10 get the Top 10 badge and a case pack, the rest of the top 10% get the elite badge.
 * Safe to run more than once: each player is rewarded for a season at most once.
 */
export async function grantSeasonRewards(season: number, now = Date.now()) {
  if (!Number.isInteger(season) || season < 1) throw new Error('Bad season number')
  if (season >= seasonOf(now)) throw new Error(`Season ${season} hasn't ended yet`)

  const { total } = await store().getSeasonLeaderboard(season, 0)
  const winners = Math.min(total, Math.max(TOP_PRIZE_COUNT, Math.ceil(total * ELITE_SHARE)))

  let granted = 0
  for (let offset = 0; offset < winners; offset += PAGE) {
    const { rows } = await store().getSeasonLeaderboard(season, Math.min(PAGE, winners - offset), offset)
    for (let i = 0; i < rows.length; i += BATCH) {
      const results = await Promise.all(
        rows.slice(i, i + BATCH).map((row, j) => rewardPlayer(row.playerId, season, offset + i + j < TOP_PRIZE_COUNT)),
      )
      granted += results.filter(Boolean).length
    }
  }
  return { season, ranked: total, rewarded: winners, granted }
}

/** Returns true if this call granted the reward (false if the player already had it). */
async function rewardPlayer(playerId: number, season: number, top10: boolean) {
  const grant = top10 ? { badge: seasonBadge(season, 'top10'), caseCredits: TOP_PRIZE_CASES } : { badge: seasonBadge(season, 'elite') }
  let fresh = false
  await store().updatePlayer(playerId, (p) => {
    fresh = !p.seasonRewards?.includes(season)
    if (!fresh) return p
    // Rewards add a badge but shouldn't swap out the one the player chose to wear.
    const next = applyGrant(p, grant)
    return { ...next, activeBadge: p.activeBadge ?? next.activeBadge, seasonRewards: [...(p.seasonRewards ?? []), season] }
  })
  return fresh
}
