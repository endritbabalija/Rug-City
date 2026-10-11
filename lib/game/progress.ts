// Clue Points, ranks, streaks and season ratings. Pure functions, shared by the
// server (awarding) and the client (rank names, season dates).
//
// Points are bragging rights only: they are never sold, have no cash value and
// never turn into a token. Season rewards are cosmetic badges and case packs.

import type { CaseFile } from '../cases/types'
import { utcDay, type Player, type RecentCase } from '../player'
import { countCorrect, score } from './engine'
import type { Award, RoomResult, Unrated, Vote } from './types'

/** A case only earns points when a real crew played it. */
export const RATED_MIN_SEATS = 3
/** Rated cases per player per UTC day, against farming. */
export const RATED_PER_DAY = 6
/** The season rating is the sum of a player's best this-many case scores. */
export const RATING_BEST_OF = 20
export const REFERRAL_POINTS = 50
/** End-of-season rewards: the top this-many get the 🏆 badge and a case pack… */
export const TOP_PRIZE_COUNT = 10
/** …and everyone else in this top share of ranked players gets the 🎖️ badge. */
export const ELITE_SHARE = 0.1

export const POINTS = { culprit: 30, motive: 15, trail: 15, crew: 10, speedMax: 10, streakPerDay: 5, streakMax: 25 }

export const RANKS = [
  { title: 'Rookie', at: 0 },
  { title: 'Sleuth', at: 250 },
  { title: 'Inspector', at: 1000 },
  { title: 'Chief Inspector', at: 3000 },
  { title: 'Chief', at: 7500 },
] as const

export const UNRATED_REASON: Record<Unrated, string> = {
  solo: `Cases need a crew of ${RATED_MIN_SEATS} or more to count.`,
  'no-vote': "You didn't vote, so this one doesn't count.",
  replay: 'You already finished this case, so replays earn nothing.',
  'daily-cap': `That's ${RATED_PER_DAY} rated cases today. Points resume tomorrow.`,
}

export function rankFor(points: number) {
  let i = 0
  while (i + 1 < RANKS.length && points >= RANKS[i + 1].at) i++
  const next = RANKS[i + 1] ?? null
  return { title: RANKS[i].title, level: i, at: RANKS[i].at, next: next ? { title: next.title, at: next.at } : null }
}

// ── Seasons ────────────────────────────────────────────────────────────────

export const SEASON_MS = 8 * 7 * 24 * 60 * 60 * 1000
/** Season 1 starts Monday 5 October 2026, 00:00 UTC. Seasons follow back to back. */
export const SEASON_EPOCH = Date.UTC(2026, 9, 5)

export function seasonOf(now: number) {
  return Math.max(1, Math.floor((now - SEASON_EPOCH) / SEASON_MS) + 1)
}

export function seasonBounds(season: number) {
  const start = SEASON_EPOCH + (season - 1) * SEASON_MS
  return { start, end: start + SEASON_MS }
}

export const sumScores = (scores: number[]) => scores.reduce((a, b) => a + b, 0)

/** This season's rating for a player (0 if they haven't played a rated case this season). */
export function seasonRating(p: Player, now: number) {
  const scores = p.season?.id === seasonOf(now) ? p.season.scores : []
  return { rating: sumScores(scores), cases: scores.length }
}

/** Streak as it stands today: it's broken if the last rated case was before yesterday. */
export function currentStreak(p: Player, now: number) {
  const day = p.lastRatedDay
  return day === utcDay(now) || day === utcDay(now - 86_400_000) ? (p.streakDays ?? 0) : 0
}

export function progressSummary(p: Player, now: number) {
  const cluePoints = p.cluePoints ?? 0
  const season = seasonOf(now)
  return {
    cluePoints,
    rank: rankFor(cluePoints),
    streakDays: currentStreak(p, now),
    season: { id: season, endsAt: seasonBounds(season).end, ...seasonRating(p, now) },
    recent: p.recent ?? [],
  }
}

// ── Awarding ───────────────────────────────────────────────────────────────

export interface CaseOutcome {
  caseFile: CaseFile
  seats: number
  vote: Vote | undefined
  result: RoomResult
  assisted: boolean
  now: number
}

const NO_POINTS: Award['points'] = { culprit: 0, motive: 0, trail: 0, crew: 0, speed: 0, streak: 0 }

function unratedReason(p: Player, o: CaseOutcome): Unrated | undefined {
  if (o.seats < RATED_MIN_SEATS) return 'solo'
  if (!o.vote) return 'no-vote'
  if (p.playedCases?.includes(o.caseFile.id)) return 'replay'
  if (p.ratedDay === utcDay(o.now) && (p.ratedCount ?? 0) >= RATED_PER_DAY) return 'daily-cap'
  return undefined
}

/**
 * Settle one finished case for one seated player. Returns the updated player, what
 * they earned, and whether their season rating changed (so the leaderboard needs a write).
 */
export function awardCase(p: Player, o: CaseOutcome): { player: Player; award: Award; ratingChanged: boolean } {
  const c = o.caseFile
  const today = utcDay(o.now)
  const unrated = unratedReason(p, o)
  // Any finished case is spoiled by the reveal, so it can never be rated later.
  const playedCases = p.playedCases?.includes(c.id) ? p.playedCases : [...(p.playedCases ?? []), c.id]
  const mine = o.vote ? score(c, o.vote, o.result.elapsedSec) : null
  const correct = o.vote ? countCorrect(c, o.vote) : 0
  const recentBase = { caseId: c.id, title: c.title, at: o.now, correct }

  if (unrated || !mine) {
    const award: Award = { unrated: unrated ?? 'no-vote', points: NO_POINTS, total: 0, streakDays: currentStreak(p, o.now) }
    const recent: RecentCase = { ...recentBase, points: 0, unrated: award.unrated }
    return { player: { ...p, playedCases, recent: [recent, ...(p.recent ?? [])].slice(0, 10) }, award, ratingChanged: false }
  }

  // Streak: the first rated case of each day extends it (or restarts it at 1) and pays the bonus.
  const firstToday = p.lastRatedDay !== today
  const streakDays = firstToday ? (p.lastRatedDay === utcDay(o.now - 86_400_000) ? (p.streakDays ?? 0) + 1 : 1) : (p.streakDays ?? 1)

  const crewCaught = o.result.correct.culprit
  const points: Award['points'] = {
    culprit: mine.correct.culprit ? POINTS.culprit : 0,
    motive: mine.correct.motive ? POINTS.motive : 0,
    trail: mine.correct.trail ? POINTS.trail : 0,
    crew: crewCaught ? POINTS.crew : 0,
    speed: crewCaught ? Math.round((o.result.points.time / 20) * POINTS.speedMax) : 0,
    streak: firstToday ? Math.min(POINTS.streakMax, POINTS.streakPerDay * streakDays) : 0,
  }
  const total = points.culprit + points.motive + points.trail + points.crew + points.speed + points.streak
  const before = p.cluePoints ?? 0
  const after = before + total
  const newRank = rankFor(after)

  // Season rating: your own accuracy and speed, on cases nobody bought help for.
  const season = seasonOf(o.now)
  const oldScores = p.season?.id === season ? p.season.scores : []
  let scores = oldScores
  if (!o.assisted) scores = [...oldScores, mine.score].sort((a, b) => b - a).slice(0, RATING_BEST_OF)
  const ratingChanged = scores.length !== oldScores.length || sumScores(scores) !== sumScores(oldScores)

  const award: Award = {
    points,
    total,
    rating: o.assisted ? undefined : mine.score,
    assisted: o.assisted || undefined,
    streakDays,
    rankUp: newRank.level > rankFor(before).level ? newRank.title : undefined,
  }
  const recent: RecentCase = { ...recentBase, points: total, rating: award.rating }
  const player: Player = {
    ...p,
    cluePoints: after,
    streakDays,
    lastRatedDay: today,
    ratedDay: today,
    ratedCount: p.ratedDay === today ? (p.ratedCount ?? 0) + 1 : 1,
    playedCases,
    season: { id: season, scores },
    recent: [recent, ...(p.recent ?? [])].slice(0, 10),
  }
  return { player, award, ratingChanged }
}
