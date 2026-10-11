import type { Grant, ItemKey } from './catalog'
import { GameError } from './game/engine'

export interface Player {
  id: number
  name: string
  username?: string
  photoUrl?: string
  caseCredits: number
  /** UTC date (YYYY-MM-DD) the daily free case was last used. */
  freeCaseDay?: string
  items: Record<ItemKey, number>
  badges: string[]
  activeBadge?: string
  /** Host who invited this player; both get a free case after the player's first finished case. */
  referredBy?: number
  referralSettled?: boolean
  createdAt: number

  // Progress (lib/game/progress.ts). All optional so older player docs keep working.
  /** Lifetime Clue Points. Never reset, never bought. */
  cluePoints?: number
  streakDays?: number
  /** UTC date of the last rated case, for streaks. */
  lastRatedDay?: string
  /** Rated cases on `ratedDay`, for the daily limit. */
  ratedDay?: string
  ratedCount?: number
  /** Every case this player has finished. Only the first finish of a case is rated. */
  playedCases?: string[]
  /** Best case scores this season (at most RATING_BEST_OF), highest first. */
  season?: { id: number; scores: number[] }
  recent?: RecentCase[]
  /** Seasons whose end-of-season rewards were already granted to this player. */
  seasonRewards?: number[]
}

export interface RecentCase {
  caseId: string
  title: string
  at: number
  points: number
  /** How many of culprit / motive / trail this player got right. */
  correct: number
  rating?: number
  unrated?: string
}

export function newPlayer(profile: { id: number; name: string; username?: string; photoUrl?: string }, now: number, referredBy?: number): Player {
  return {
    ...profile,
    caseCredits: 0,
    items: { subpoena: 0, trace: 0, hint: 0 },
    badges: [],
    referredBy: referredBy && referredBy !== profile.id ? referredBy : undefined,
    createdAt: now,
  }
}

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10)

export function hasFreeCase(p: Player, now: number) {
  return p.freeCaseDay !== utcDay(now)
}

/** Use today's free case, or a case credit. Throws NO_CASES when neither is available. */
export function consumeCase(p: Player, now: number): Player {
  if (hasFreeCase(p, now)) return { ...p, freeCaseDay: utcDay(now) }
  if (p.caseCredits > 0) return { ...p, caseCredits: p.caseCredits - 1 }
  throw new GameError('NO_CASES', "You've used today's free case. Grab a case pack to host another.", 402)
}

export function spendItem(p: Player, item: ItemKey): Player {
  if ((p.items[item] ?? 0) <= 0) throw new GameError('NO_ITEM', `You have no ${item} left. Get more in the shop.`, 402)
  return { ...p, items: { ...p.items, [item]: p.items[item] - 1 } }
}

export function applyGrant(p: Player, g: Grant, sign: 1 | -1 = 1): Player {
  const items = { ...p.items }
  for (const [k, n] of Object.entries(g.items ?? {}) as [ItemKey, number][]) items[k] = Math.max(0, (items[k] ?? 0) + sign * n)
  let badges = p.badges
  let activeBadge = p.activeBadge
  if (g.badge) {
    if (sign === 1) {
      if (!badges.includes(g.badge)) badges = [...badges, g.badge]
      activeBadge = g.badge
    } else {
      badges = badges.filter((b) => b !== g.badge)
      if (activeBadge === g.badge) activeBadge = undefined
    }
  }
  return { ...p, caseCredits: Math.max(0, p.caseCredits + sign * (g.caseCredits ?? 0)), items, badges, activeBadge }
}
