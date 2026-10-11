// Clue Points, ranks, streaks and season ratings. Pure functions, shared by the
// server (awarding) and the client (rank names, season dates).
//
// Points are bragging rights only: they are never sold, have no cash value and
// never turn into a token. Season rewards are cosmetic badges and case packs.

import type { CaseFile } from '../cases/types'
import { utcDay, type Player, type RecentCase } from '../player'
import { countCorrect, score } from './engine'
import { applyPenalty, CASE_POINTS, PENALIZE_CLUE_POINTS } from './scoring'
import type { Award, CaseMode, CaseResultRow, RoomResult, Unrated, Vote } from './types'

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
  { title: 'Inspector', at: 500 },
  { title: 'Chief', at: 2500 },
  { title: 'Legend', at: 10_000 },
] as const

export const UNRATED_REASON: Record<Unrated, string> = {
  'no-vote': "You didn't vote, so this one doesn't count.",
  replay: "You've already opened this case's evidence before, so replays earn nothing.",
  'daily-cap': `That's ${RATED_PER_DAY} rated cases today. Points resume tomorrow.`,
}

export function rankFor(points: number) {
  let i = 0
  while (i + 1 < RANKS.length && points >= RANKS[i + 1].at) i++
  const next = RANKS[i + 1] ?? null
  return { title: RANKS[i].title, level: i, at: RANKS[i].at, next: next ? { title: next.title, at: next.at } : null }
}

// ── Seasons ────────────────────────────────────────────────────────────────

/** One row of the `seasons` table. `end` is exclusive. */
export interface Season {
  id: number
  start: number
  end: number
}

/** Seasons past the last stored one keep its length, so the calendar never runs out. */
function extend(last: Season, n: number): Season {
  const len = last.end - last.start
  return { id: last.id + n, start: last.end + (n - 1) * len, end: last.end + n * len }
}

function sorted(seasons: Season[]) {
  if (!seasons.length) throw new Error('No seasons configured')
  return [...seasons].sort((a, b) => a.id - b.id)
}

/** The season running at `now`. Before the first season starts, that's the first season. */
export function seasonAt(now: number, seasons: Season[]): Season {
  const list = sorted(seasons)
  const last = list.at(-1)!
  if (now >= last.end) return extend(last, Math.floor((now - last.end) / (last.end - last.start)) + 1)
  return list.find((s) => now < s.end)!
}

export function seasonById(id: number, seasons: Season[]): Season {
  const list = sorted(seasons)
  const last = list.at(-1)!
  if (id > last.id) return extend(last, id - last.id)
  const s = list.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown season ${id}`)
  return s
}

export const sumScores = (scores: number[]) => scores.reduce((a, b) => a + b, 0)

/** A season rating from every rated score this season: the sum of the best RATING_BEST_OF. */
export function seasonRating(scores: number[]) {
  const best = [...scores].sort((a, b) => b - a).slice(0, RATING_BEST_OF)
  return { rating: sumScores(best), cases: best.length }
}

/** Streak as it stands today: it's broken if the last rated case was before yesterday. */
export function currentStreak(p: Player, now: number) {
  const day = p.lastRatedDay
  return day === utcDay(now) || day === utcDay(now - 86_400_000) ? (p.streakDays ?? 0) : 0
}

export function progressSummary(p: Player, now: number, from: { seasons: Season[]; seasonScores: number[]; recent: RecentCase[] }) {
  const cluePoints = p.cluePoints ?? 0
  const season = seasonAt(now, from.seasons)
  return {
    cluePoints,
    rank: rankFor(cluePoints),
    streakDays: currentStreak(p, now),
    season: { id: season.id, endsAt: season.end, ...seasonRating(from.seasonScores) },
    recent: from.recent,
  }
}

// ── Awarding ───────────────────────────────────────────────────────────────

export interface CaseOutcome {
  code: string
  caseFile: CaseFile
  mode: CaseMode
  seats: number
  vote: Vote | undefined
  /** The crew's verdict; it carries the target time and the room's help. */
  result: RoomResult
  now: number
  /** The player already finished or started this case in another room. */
  alreadyPlayed: boolean
  /** The player's rated scores so far this season. */
  seasonScores: number[]
}

const NO_POINTS: Award['points'] = { culprit: 0, motive: 0, trail: 0, crew: 0, speed: 0, streak: 0 }

function unratedReason(p: Player, o: CaseOutcome): Unrated | undefined {
  if (!o.vote) return 'no-vote'
  if (o.alreadyPlayed) return 'replay'
  if (p.ratedDay === utcDay(o.now) && (p.ratedCount ?? 0) >= RATED_PER_DAY) return 'daily-cap'
  return undefined
}

/** A player's counters after an award. Applied to the freshest row, so concurrent settles add up. */
export function applyAward(p: Player, award: Award, now: number): Player {
  if (award.unrated) return p
  const today = utcDay(now)
  return {
    ...p,
    cluePoints: (p.cluePoints ?? 0) + award.total,
    streakDays: award.streakDays,
    lastRatedDay: today,
    ratedDay: today,
    ratedCount: p.ratedDay === today ? (p.ratedCount ?? 0) + 1 : 1,
  }
}

/**
 * Settle one finished case for one seated player. Returns the updated player, what they
 * earned, the `case_results` row to insert, and whether their season rating changed (so
 * the leaderboard needs a write). Any finished case is spoiled by the reveal, so the row
 * is written even when nothing was earned: it makes every later finish a replay.
 */
export function awardCase(p: Player, o: CaseOutcome): { player: Player; award: Award; result: CaseResultRow; ratingChanged: boolean } {
  const c = o.caseFile
  const today = utcDay(o.now)
  const unrated = unratedReason(p, o)
  const mine = o.vote ? score(c, o.vote, o.result.elapsedSec, o.result.targetSec, o.result.help) : null
  const row = {
    roomCode: o.code,
    playerId: p.id,
    caseId: c.id,
    mode: o.mode,
    seats: o.seats,
    correct: o.vote ? countCorrect(c, o.vote) : 0,
    score: mine?.score ?? 0,
    elapsedSec: o.result.elapsedSec,
    at: o.now,
  }

  if (unrated || !mine) {
    const award: Award = { unrated: unrated ?? 'no-vote', points: NO_POINTS, total: 0, streakDays: currentStreak(p, o.now) }
    return { player: p, award, result: { ...row, points: award.points, total: 0, unrated: award.unrated }, ratingChanged: false }
  }

  // Streak: the first rated case of each day extends it (or restarts it at 1) and pays the bonus.
  const firstToday = p.lastRatedDay !== today
  const streakDays = firstToday ? (p.lastRatedDay === utcDay(o.now - 86_400_000) ? (p.streakDays ?? 0) + 1 : 1) : (p.streakDays ?? 1)

  const crewCaught = o.result.correct.culprit
  // Help cuts the case parts; the crew and streak bonuses stay whole.
  const cut = (n: number) => (PENALIZE_CLUE_POINTS ? applyPenalty(n, o.result.penalty) : n)
  const points: Award['points'] = {
    culprit: cut(mine.correct.culprit ? POINTS.culprit : 0),
    motive: cut(mine.correct.motive ? POINTS.motive : 0),
    trail: cut(mine.correct.trail ? POINTS.trail : 0),
    crew: crewCaught ? POINTS.crew : 0,
    speed: cut(crewCaught ? Math.round((o.result.points.time / CASE_POINTS.time) * POINTS.speedMax) : 0),
    streak: firstToday ? Math.min(POINTS.streakMax, POINTS.streakPerDay * streakDays) : 0,
  }
  const total = points.culprit + points.motive + points.trail + points.crew + points.speed + points.streak
  const before = p.cluePoints ?? 0
  const newRank = rankFor(before + total)

  // Season rating: your own accuracy and speed, after the room's help penalty.
  const old = seasonRating(o.seasonScores)
  const next = seasonRating([...o.seasonScores, mine.score])
  const ratingChanged = next.rating !== old.rating || next.cases !== old.cases

  const award: Award = {
    points,
    total,
    rating: mine.score,
    streakDays,
    rankUp: newRank.level > rankFor(before).level ? newRank.title : undefined,
  }
  return { player: applyAward(p, award, o.now), award, result: { ...row, points, total, rating: award.rating }, ratingChanged }
}
