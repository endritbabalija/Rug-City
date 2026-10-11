import 'server-only'
import { applyGrant, type Player } from './player'
import { seasonBadge } from './catalog'
import { ELITE_SHARE, seasonAt, seasonById, TOP_PRIZE_COUNT } from './game/progress'
import { getSeasons } from './seasons'
import { store } from './store'

export const LEADERBOARD_SIZE = 50
/** Winners are read this many rows at a time and rewarded this many at once. */
const PAGE = 500
const BATCH = 20
/** Case credits for each top-10 finisher. */
export const TOP_PRIZE_CASES = 5

/** A season's leaderboard; the current season when none is asked for, never a future one. */
export async function leaderboard(player: Player, requested?: number) {
  const seasons = await getSeasons()
  const current = seasonAt(Date.now(), seasons).id
  const season = Math.min(requested ?? current, current)
  const { start, end } = seasonById(season, seasons)
  const [{ rows, total }, position] = await Promise.all([
    store().getSeasonLeaderboard(season, LEADERBOARD_SIZE),
    store().getSeasonPosition(season, player.id),
  ])
  return {
    season,
    start,
    end,
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
  if (season >= seasonAt(now, await getSeasons()).id) throw new Error(`Season ${season} hasn't ended yet`)

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

/**
 * Returns true if this call granted the reward (false if the player already had it).
 * The `season_rewards` row is the claim, so two runs can't both pay; if the grant then
 * fails, the error is logged with the player id so an admin can grant it by hand.
 */
async function rewardPlayer(playerId: number, season: number, top10: boolean) {
  if (!(await store().addSeasonReward(season, playerId))) return false
  const grant = top10 ? { badge: seasonBadge(season, 'top10'), caseCredits: TOP_PRIZE_CASES } : { badge: seasonBadge(season, 'elite') }
  try {
    await store().addBadge(playerId, grant.badge)
    await store().updatePlayer(playerId, (p) => {
      // Rewards add a badge but shouldn't swap out the one the player chose to wear.
      const next = applyGrant(p, grant).player
      return { ...next, activeBadge: p.activeBadge ?? next.activeBadge }
    })
  } catch (err) {
    console.error('Season reward claimed but not granted', season, playerId, err)
    throw err
  }
  return true
}
