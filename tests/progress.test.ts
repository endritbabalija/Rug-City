import { describe, expect, it } from 'vitest'
import { mooncat } from '@/lib/cases/mooncat'
import { score as engineScore } from '@/lib/game/engine'
import {
  applyAward,
  awardCase,
  currentStreak,
  rankFor,
  RATED_PER_DAY,
  RATING_BEST_OF,
  seasonAt,
  seasonById,
  seasonRating,
  type CaseOutcome,
} from '@/lib/game/progress'
import { NO_HELP } from '@/lib/game/scoring'
import type { Help, Vote } from '@/lib/game/types'
import { newPlayer, type Player } from '@/lib/player'
import { SEASON_SEED } from '@/lib/store/memory'

const NOW = Date.UTC(2026, 9, 14, 12)
const DAY = 86_400_000
const right: Vote = { ...mooncat.answer }
const wrongMotive: Vote = { ...mooncat.answer, motive: mooncat.motives.find((m) => m.id !== mooncat.answer.motive)!.id }

function outcome(over: Partial<CaseOutcome> = {}): CaseOutcome {
  return {
    code: 'ABCDE',
    caseFile: mooncat,
    mode: 'crew',
    seats: 4,
    vote: right,
    result: score(right, 9 * 60),
    now: NOW,
    alreadyPlayed: false,
    seasonScores: [],
    ...over,
  }
}
const fresh = (): Player => newPlayer({ id: 1, name: 'Ana' }, NOW)
/** The crew's verdict for a vote, against the case's own target. */
const score = (vote: Vote, elapsedSec: number, help: Help = NO_HELP) => engineScore(mooncat, vote, elapsedSec, mooncat.targetSec, help)

describe('ranks', () => {
  it('climbs at the thresholds', () => {
    expect(rankFor(0)).toMatchObject({ title: 'Rookie', next: { title: 'Inspector', at: 500 } })
    expect(rankFor(499).title).toBe('Rookie')
    expect(rankFor(500)).toMatchObject({ title: 'Inspector', next: { title: 'Chief', at: 2500 } })
    expect(rankFor(2499).title).toBe('Inspector')
    expect(rankFor(2500)).toMatchObject({ title: 'Chief', next: { title: 'Legend', at: 10_000 } })
    expect(rankFor(9999).title).toBe('Chief')
    expect(rankFor(10_000)).toMatchObject({ title: 'Legend', next: null })
    expect(rankFor(1_000_000).title).toBe('Legend')
  })
})

describe('seasons', () => {
  const at = (iso: string) => seasonAt(Date.parse(iso), SEASON_SEED).id

  it('switches seasons exactly at the boundaries', () => {
    expect(at('2026-10-05T00:00:00Z')).toBe(1)
    expect(at('2026-11-01T23:59:59.999Z')).toBe(1)
    expect(at('2026-11-02T00:00:00Z')).toBe(2)
    expect(at('2026-11-30T00:00:00Z')).toBe(3)
    // Before the first season, it's season 1.
    expect(at('2026-09-01T00:00:00Z')).toBe(1)
  })

  it('runs three 4-week seasons, then 8-week seasons from S4', () => {
    expect(at('2026-12-27T23:59:59.999Z')).toBe(3)
    expect(at('2026-12-28T00:00:00Z')).toBe(4)
    expect(seasonById(3, SEASON_SEED).end - seasonById(3, SEASON_SEED).start).toBe(28 * DAY)
    expect(seasonById(4, SEASON_SEED)).toEqual({ id: 4, start: Date.UTC(2026, 11, 28), end: Date.UTC(2026, 11, 28) + 56 * DAY })
    expect(at('2027-02-21T23:59:59.999Z')).toBe(4)
    expect(at('2027-02-22T00:00:00Z')).toBe(5)
  })

  it('keeps going past the last stored season with its length', () => {
    const last = SEASON_SEED.at(-1)!
    expect(seasonAt(last.end, SEASON_SEED)).toEqual({ id: last.id + 1, start: last.end, end: last.end + 56 * DAY })
    expect(seasonAt(last.end + 56 * DAY, SEASON_SEED).id).toBe(last.id + 2)
    expect(seasonById(last.id + 2, SEASON_SEED).start).toBe(last.end + 56 * DAY)
  })
})

describe('awardCase', () => {
  it('pays for your own vote, the crew catch, speed and the streak', () => {
    const { player, award, result, ratingChanged } = awardCase(fresh(), outcome())
    expect(award.points).toEqual({ culprit: 30, motive: 15, trail: 15, crew: 10, speed: 10, streak: 5 })
    expect(award.total).toBe(85)
    expect(award.rating).toBe(120)
    expect(ratingChanged).toBe(true)
    expect(player.cluePoints).toBe(85)
    expect(result).toMatchObject({ roomCode: 'ABCDE', playerId: 1, caseId: mooncat.id, correct: 3, score: 120, total: 85, rating: 120 })
    expect(result.unrated).toBeUndefined()
  })

  it('scores your own vote even when the crew voted differently', () => {
    const crewRight = score(right, 9 * 60)
    const { award } = awardCase(fresh(), outcome({ vote: wrongMotive, result: crewRight }))
    expect(award.points.motive).toBe(0)
    expect(award.points.crew).toBe(10)
    expect(award.rating).toBe(score(wrongMotive, 9 * 60).score)
  })

  it('rates solo-sized and crew rooms alike, and records the mode', () => {
    for (const seats of [1, 2, 3, 6]) {
      const { award } = awardCase(fresh(), outcome({ seats }))
      expect(award.unrated).toBeUndefined()
      expect(award).toMatchObject({ total: 85, rating: 120 })
    }
    expect(awardCase(fresh(), outcome({ seats: 1, mode: 'solo' })).result).toMatchObject({ mode: 'solo', seats: 1, rating: 120 })
  })

  it('gives nothing for missing votes and replays, but still records the case', () => {
    const noVote = awardCase(fresh(), outcome({ vote: undefined }))
    expect(noVote.award.unrated).toBe('no-vote')
    expect(noVote.result).toMatchObject({ caseId: mooncat.id, total: 0, unrated: 'no-vote' })
    expect(noVote.result.rating).toBeUndefined()
    expect(awardCase(noVote.player, outcome({ now: NOW + DAY, alreadyPlayed: true })).award.unrated).toBe('replay')
  })

  it('stops rating after the daily limit and starts again the next day', () => {
    const p = { ...fresh(), ratedDay: '2026-10-14', ratedCount: RATED_PER_DAY }
    expect(awardCase(p, outcome()).award.unrated).toBe('daily-cap')
    expect(awardCase({ ...fresh(), ratedDay: '2026-10-14', ratedCount: RATED_PER_DAY - 1 }, outcome()).award.unrated).toBeUndefined()
    expect(awardCase(p, outcome({ now: NOW + DAY })).award.unrated).toBeUndefined()
  })

  it('builds a streak once per day, caps the bonus and resets after a missed day', () => {
    let p = fresh()
    const bonuses: number[] = []
    for (let d = 0; d < 7; d++) {
      const r = awardCase(p, outcome({ now: NOW + d * DAY }))
      bonuses.push(r.award.points.streak)
      p = r.player
    }
    expect(bonuses).toEqual([5, 10, 15, 20, 25, 25, 25])
    expect(p.streakDays).toBe(7)

    // A second case the same day keeps the streak but pays no bonus.
    const again = awardCase(p, outcome({ now: NOW + 6 * DAY + 1000 }))
    expect(again.award.points.streak).toBe(0)
    expect(again.award.streakDays).toBe(7)

    expect(currentStreak(p, NOW + 7 * DAY)).toBe(7)
    expect(currentStreak(p, NOW + 8 * DAY)).toBe(0)
    expect(awardCase(p, outcome({ now: NOW + 9 * DAY })).award.streakDays).toBe(1)
  })

  it('rates aided cases with the penalty, and cuts their case Clue Points but not the bonuses', () => {
    const traced = score(right, 9 * 60, { ...NO_HELP, trace: 1 })
    const { award, result, ratingChanged } = awardCase(fresh(), outcome({ result: traced }))
    expect(award.rating).toBe(102)
    expect(result).toMatchObject({ score: 102, rating: 102 })
    expect(ratingChanged).toBe(true)
    // 85% of 30, 15, 15 and 10, rounded; crew and streak untouched.
    expect(award.points).toEqual({ culprit: 26, motive: 13, trail: 13, crew: 10, speed: 9, streak: 5 })
    expect(award.total).toBe(76)
  })

  it('applies the room’s help to every seat, whatever their own vote', () => {
    const help = { ...NO_HELP, subpoena: 1 }
    const { award } = awardCase(fresh(), outcome({ vote: wrongMotive, result: score(right, 9 * 60, help) }))
    expect(award.rating).toBe(score(wrongMotive, 9 * 60, help).score)
    expect(award.rating).toBe(Math.round(95 * 0.75))
  })

  it('always rates a clean solve above an aided one with the same answers and time', () => {
    const clean = awardCase(fresh(), outcome()).award
    const aided = awardCase(fresh(), outcome({ result: score(right, 9 * 60, { ...NO_HELP, hint: 1 }) })).award
    expect(clean.rating!).toBeGreaterThan(aided.rating!)
    expect(clean.total).toBeGreaterThan(aided.total)
  })

  it('keeps only the best scores and starts fresh each season', () => {
    const scores = Array.from({ length: RATING_BEST_OF }, () => 100)
    const low = awardCase(fresh(), outcome({ vote: wrongMotive, result: score(wrongMotive, 9 * 60), seasonScores: scores }))
    expect(seasonRating([...scores, low.award.rating!])).toEqual(seasonRating(scores))
    expect(low.ratingChanged).toBe(false)
    const high = awardCase(fresh(), outcome({ seasonScores: scores }))
    expect(high.ratingChanged).toBe(true)
    expect(seasonRating([...scores, high.award.rating!])).toEqual({ rating: 100 * (RATING_BEST_OF - 1) + 120, cases: RATING_BEST_OF })

    // A new season's scores start empty.
    const nextSeason = awardCase(fresh(), outcome({ now: NOW + 56 * DAY, seasonScores: [] }))
    expect(seasonRating([nextSeason.award.rating!])).toEqual({ rating: 120, cases: 1 })
  })

  it('announces a rank-up across each threshold', () => {
    expect(awardCase({ ...fresh(), cluePoints: 450 }, outcome()).award.rankUp).toBe('Inspector')
    expect(awardCase({ ...fresh(), cluePoints: 2450 }, outcome()).award.rankUp).toBe('Chief')
    expect(awardCase({ ...fresh(), cluePoints: 9950 }, outcome()).award.rankUp).toBe('Legend')
    expect(awardCase({ ...fresh(), cluePoints: 10 }, outcome()).award.rankUp).toBeUndefined()
    expect(awardCase({ ...fresh(), cluePoints: 500 }, outcome()).award.rankUp).toBeUndefined()
  })

  it('adds an award to the freshest player row, so concurrent settles both count', () => {
    const { award } = awardCase(fresh(), outcome())
    const meanwhile = { ...fresh(), cluePoints: 40, ratedDay: '2026-10-14', ratedCount: 1 }
    expect(applyAward(meanwhile, award, NOW)).toMatchObject({ cluePoints: 125, ratedCount: 2, streakDays: 1, lastRatedDay: '2026-10-14' })
    expect(applyAward(meanwhile, { ...award, unrated: 'replay' }, NOW)).toBe(meanwhile)
  })
})
