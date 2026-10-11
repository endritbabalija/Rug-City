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
  /** Day-one free cases used on the signup UTC day (flag `tutorial`). */
  dayOneUsed?: number
  items: Record<ItemKey, number>
  /** Owned badges live in the store (`getBadges`); this is the one being worn. */
  activeBadge?: string
  /** Host who invited this player; both get a free case after the player's first finished case. */
  referredBy?: number
  referralSettled?: boolean
  createdAt: number

  // Progress (lib/game/progress.ts). Finished cases, recent cases and season scores are
  // `case_results` rows in the store; season rewards are `season_rewards` rows.
  /** Lifetime Clue Points. Never reset, never bought. */
  cluePoints?: number
  streakDays?: number
  /** UTC date of the last rated case, for streaks. */
  lastRatedDay?: string
  /** Rated cases on `ratedDay`, for the daily limit. */
  ratedDay?: string
  ratedCount?: number
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
    referredBy: referredBy && referredBy !== profile.id ? referredBy : undefined,
    createdAt: now,
  }
}

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10)

/** Free cases on the player's signup UTC day, instead of the daily one (flag `tutorial`). */
export const DAY_ONE_FREE_CASES = 3

export function hasFreeCase(p: Player, now: number) {
  return p.freeCaseDay !== utcDay(now)
}

const onSignupDay = (p: Player, now: number) => utcDay(p.createdAt) === utcDay(now)

/** Day-one cases the player has left today: none once their signup day is over, or with `dayOne` off. */
export function dayOneLeft(p: Player, now: number, dayOne: boolean) {
  return dayOne && onSignupDay(p, now) ? Math.max(0, DAY_ONE_FREE_CASES - (p.dayOneUsed ?? 0)) : 0
}

/**
 * Free cases the player has left today. On the signup day (with `dayOne`) that's the day-one
 * cases, which replace the daily one; every other day it's the daily free case.
 */
export function freeCasesToday(p: Player, now: number, dayOne: boolean) {
  if (dayOne && onSignupDay(p, now)) return dayOneLeft(p, now, dayOne)
  return hasFreeCase(p, now) ? 1 : 0
}

/** What the next case would be paid with, or null if the player has nothing left. */
export type CaseSource = 'dayOne' | 'free' | 'credit'

export function caseSource(p: Player, now: number, dayOne: boolean): CaseSource | null {
  if (dayOne && onSignupDay(p, now)) {
    if (dayOneLeft(p, now, dayOne) > 0) return 'dayOne'
  } else if (hasFreeCase(p, now)) return 'free'
  return p.caseCredits > 0 ? 'credit' : null
}

/**
 * Use a free case (day-one cases on the signup day, else today's free case) or a case credit.
 * Throws NO_CASES when there's none. `dayOne` is flag `tutorial`.
 */
export function consumeCase(p: Player, now: number, dayOne = false): Player {
  switch (caseSource(p, now, dayOne)) {
    case 'dayOne':
      return { ...p, dayOneUsed: (p.dayOneUsed ?? 0) + 1 }
    case 'free':
      return { ...p, freeCaseDay: utcDay(now) }
    case 'credit':
      return { ...p, caseCredits: p.caseCredits - 1 }
    case null:
      throw new GameError('NO_CASES', "You're out of free cases for today. Get a case pack to play more.", 402)
  }
}

/** Gives back a case `consumeCase` took from `source`. */
export function refundCase(p: Player, source: CaseSource): Player {
  if (source === 'dayOne') return { ...p, dayOneUsed: Math.max(0, (p.dayOneUsed ?? 0) - 1) }
  if (source === 'free') return { ...p, freeCaseDay: undefined }
  return { ...p, caseCredits: p.caseCredits + 1 }
}

export function spendItem(p: Player, item: ItemKey): Player {
  if ((p.items[item] ?? 0) <= 0) throw new GameError('NO_ITEM', `You have no ${item} left. Get more in the shop.`, 402)
  return { ...p, items: { ...p.items, [item]: p.items[item] - 1 } }
}

/** A badge a grant adds or takes back; the caller writes it with `addBadge` / `removeBadge`. */
export type BadgeChange = { add: string } | { remove: string }

export function applyGrant(p: Player, g: Grant, sign: 1 | -1 = 1): { player: Player; badge?: BadgeChange } {
  const items = { ...p.items }
  for (const [k, n] of Object.entries(g.items ?? {}) as [ItemKey, number][]) items[k] = Math.max(0, (items[k] ?? 0) + sign * n)
  let activeBadge = p.activeBadge
  let badge: BadgeChange | undefined
  if (g.badge) {
    if (sign === 1) {
      badge = { add: g.badge }
      activeBadge = g.badge
    } else {
      badge = { remove: g.badge }
      if (activeBadge === g.badge) activeBadge = undefined
    }
  }
  return { player: { ...p, caseCredits: Math.max(0, p.caseCredits + sign * (g.caseCredits ?? 0)), items, activeBadge }, badge }
}
