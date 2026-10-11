import { describe, expect, it } from 'vitest'
import { mooncat } from '@/lib/cases/mooncat'
import { score } from '@/lib/game/engine'
import {
  awardCase,
  currentStreak,
  rankFor,
  RATED_PER_DAY,
  RATING_BEST_OF,
  seasonBounds,
  seasonOf,
  SEASON_EPOCH,
  SEASON_MS,
  type CaseOutcome,
} from '@/lib/game/progress'
import type { Vote } from '@/lib/game/types'
import { newPlayer, type Player } from '@/lib/player'

const NOW = Date.UTC(2026, 9, 14, 12)
const DAY = 86_400_000
const right: Vote = { ...mooncat.answer }
const wrongMotive: Vote = { ...mooncat.answer, motive: mooncat.motives.find((m) => m.id !== mooncat.answer.motive)!.id }

function outcome(over: Partial<CaseOutcome> = {}): CaseOutcome {
  return { caseFile: mooncat, seats: 4, vote: right, result: score(mooncat, right, 9 * 60), assisted: false, now: NOW, ...over }
}
const fresh = (): Player => newPlayer({ id: 1, name: 'Ana' }, NOW)

describe('ranks', () => {
  it('climbs at the thresholds', () => {
    expect(rankFor(0).title).toBe('Rookie')
    expect(rankFor(249).title).toBe('Rookie')
    expect(rankFor(250).title).toBe('Sleuth')
    expect(rankFor(1000)).toMatchObject({ title: 'Inspector', next: { title: 'Chief Inspector', at: 3000 } })
    expect(rankFor(1_000_000)).toMatchObject({ title: 'Chief', next: null })
  })
})

describe('seasons', () => {
  it('runs 8-week seasons back to back from the epoch', () => {
    expect(seasonOf(SEASON_EPOCH)).toBe(1)
    expect(seasonOf(SEASON_EPOCH + SEASON_MS - 1)).toBe(1)
    expect(seasonOf(SEASON_EPOCH + SEASON_MS)).toBe(2)
    expect(seasonOf(SEASON_EPOCH - DAY)).toBe(1)
    expect(seasonBounds(2).start).toBe(SEASON_EPOCH + SEASON_MS)
  })
})

describe('awardCase', () => {
  it('pays for your own vote, the crew catch, speed and the streak', () => {
    const { player, award, ratingChanged } = awardCase(fresh(), outcome())
    expect(award.points).toEqual({ culprit: 30, motive: 15, trail: 15, crew: 10, speed: 10, streak: 5 })
    expect(award.total).toBe(85)
    expect(award.rating).toBe(120)
    expect(ratingChanged).toBe(true)
    expect(player.cluePoints).toBe(85)
    expect(player.season).toEqual({ id: seasonOf(NOW), scores: [120] })
    expect(player.playedCases).toEqual([mooncat.id])
  })

  it('scores your own vote even when the crew voted differently', () => {
    const crewRight = score(mooncat, right, 9 * 60)
    const { award } = awardCase(fresh(), outcome({ vote: wrongMotive, result: crewRight }))
    expect(award.points.motive).toBe(0)
    expect(award.points.crew).toBe(10)
    expect(award.rating).toBe(score(mooncat, wrongMotive, 9 * 60).score)
  })

  it('gives nothing for solo games, missing votes and replays, but still marks the case played', () => {
    expect(awardCase(fresh(), outcome({ seats: 1 })).award).toMatchObject({ unrated: 'solo', total: 0 })
    const noVote = awardCase(fresh(), outcome({ vote: undefined }))
    expect(noVote.award.unrated).toBe('no-vote')
    expect(noVote.player.playedCases).toEqual([mooncat.id])
    expect(awardCase(noVote.player, outcome({ now: NOW + DAY })).award.unrated).toBe('replay')
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
      const r = awardCase({ ...p, playedCases: [] }, outcome({ now: NOW + d * DAY }))
      bonuses.push(r.award.points.streak)
      p = r.player
    }
    expect(bonuses).toEqual([5, 10, 15, 20, 25, 25, 25])
    expect(p.streakDays).toBe(7)

    // A second case the same day keeps the streak but pays no bonus.
    const again = awardCase({ ...p, playedCases: [] }, outcome({ now: NOW + 6 * DAY + 1000 }))
    expect(again.award.points.streak).toBe(0)
    expect(again.award.streakDays).toBe(7)

    expect(currentStreak(p, NOW + 7 * DAY)).toBe(7)
    expect(currentStreak(p, NOW + 8 * DAY)).toBe(0)
    expect(awardCase({ ...p, playedCases: [] }, outcome({ now: NOW + 9 * DAY })).award.streakDays).toBe(1)
  })

  it('keeps power-up cases out of the season rating but still pays Clue Points', () => {
    const { player, award, ratingChanged } = awardCase(fresh(), outcome({ assisted: true }))
    expect(award.total).toBe(85)
    expect(award.rating).toBeUndefined()
    expect(ratingChanged).toBe(false)
    expect(player.season?.scores).toEqual([])
  })

  it('keeps only the best scores and starts fresh each season', () => {
    const scores = Array.from({ length: RATING_BEST_OF }, () => 100)
    const p = { ...fresh(), season: { id: seasonOf(NOW), scores } }
    const low = awardCase(p, outcome({ vote: wrongMotive, result: score(mooncat, wrongMotive, 9 * 60) }))
    expect(low.player.season?.scores).toEqual(scores)
    expect(low.ratingChanged).toBe(false)
    const high = awardCase(p, outcome())
    expect(high.player.season?.scores[0]).toBe(120)
    expect(high.player.season?.scores).toHaveLength(RATING_BEST_OF)

    const nextSeason = awardCase(p, outcome({ now: NOW + SEASON_MS }))
    expect(nextSeason.player.season).toEqual({ id: seasonOf(NOW) + 1, scores: [120] })
  })

  it('announces a rank-up', () => {
    expect(awardCase({ ...fresh(), cluePoints: 240 }, outcome()).award.rankUp).toBe('Sleuth')
    expect(awardCase({ ...fresh(), cluePoints: 10 }, outcome()).award.rankUp).toBeUndefined()
  })
})
