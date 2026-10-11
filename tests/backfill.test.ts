import { describe, expect, it } from 'vitest'
import { docHash, rowsFromDoc } from '@/scripts/backfill-v2.mjs'

const T = (iso: string) => Date.parse(iso)

/** A player doc as the code before migration 0004 stored it. */
const oldDoc = {
  id: 42,
  name: 'Ana',
  username: 'ana',
  caseCredits: 3,
  freeCaseDay: '2026-10-10',
  items: { subpoena: 1, trace: 0, hint: 2 },
  badges: ['hound', 's1-elite'],
  activeBadge: 'hound',
  referredBy: 7,
  referralSettled: true,
  createdAt: T('2026-10-01T00:00:00Z'),
  cluePoints: 310,
  streakDays: 2,
  lastRatedDay: '2026-10-10',
  ratedDay: '2026-10-10',
  ratedCount: 1,
  playedCases: ['mooncat-exit', 'airdrop-of-doom', 'audit-that-wasnt'],
  season: { id: 1, scores: [120, 95, 80] },
  recent: [
    { caseId: 'mooncat-exit', title: 'Mooncat', at: T('2026-10-10T12:00:00Z'), points: 0, correct: 3, unrated: 'replay' },
    { caseId: 'airdrop-of-doom', title: 'Airdrop', at: T('2026-10-09T12:00:00Z'), points: 70, correct: 2, rating: 95 },
    { caseId: 'mooncat-exit', title: 'Mooncat', at: T('2026-10-08T12:00:00Z'), points: 85, correct: 3, rating: 120 },
  ],
  seasonRewards: [1],
}

describe('backfill-v2', () => {
  it('copies the counters into player columns', () => {
    expect(rowsFromDoc(42, oldDoc).player).toEqual({
      name: 'Ana',
      username: 'ana',
      photo_url: null,
      case_credits: 3,
      subpoena: 1,
      trace: 0,
      hint: 2,
      free_case_day: '2026-10-10',
      referred_by: 7,
      referral_settled: true,
      active_badge: 'hound',
      clue_points: 310,
      streak_days: 2,
      last_rated_day: '2026-10-10',
      rated_day: '2026-10-10',
      rated_count: 1,
    })
  })

  it('turns badges and season rewards into rows', () => {
    const out = rowsFromDoc(42, oldDoc)
    expect(out.badges).toEqual([
      { player_id: 42, badge: 'hound' },
      { player_id: 42, badge: 's1-elite' },
    ])
    expect(out.seasonRewards).toEqual([{ season: 1, player_id: 42 }])
  })

  it('rebuilds one legacy result per case, keeping the first finish over a replay', () => {
    const { results } = rowsFromDoc(42, oldDoc)
    const byRoom = Object.fromEntries(results.map((r) => [r.room_code, r]))
    expect(byRoom['legacy-mooncat-exit']).toMatchObject({ case_id: 'mooncat-exit', total: 85, rating: 120, unrated: null, mode: 'legacy', at: '2026-10-08T12:00:00.000Z' })
    expect(byRoom['legacy-airdrop-of-doom']).toMatchObject({ total: 70, rating: 95, correct: 2 })
    // Played but no longer in `recent`: still there, so a replay stays unrated.
    expect(byRoom['legacy-audit-that-wasnt']).toMatchObject({ case_id: 'audit-that-wasnt', total: 0, rating: null, unrated: 'legacy' })
    // The season score with no matching recent case gets its own row, inside season 1.
    expect(byRoom['legacy-s1-0']).toMatchObject({ case_id: 'legacy', rating: 80, at: '2026-10-05T00:00:00.000Z' })
    expect(results).toHaveLength(4)
    // Legacy codes can never be a real room code (5 characters, A-Z 0-9).
    for (const r of results) expect(r.room_code).not.toMatch(/^[A-Z0-9]{5}$/)
    // Season scores come out the same.
    expect(results.flatMap((r) => (r.rating === null ? [] : [r.rating])).sort((a, b) => b - a)).toEqual([120, 95, 80])
  })

  it('handles a fresh doc with no progress', () => {
    const out = rowsFromDoc(5, { id: 5, name: 'New', caseCredits: 0, items: { subpoena: 0, trace: 0, hint: 0 }, badges: [], createdAt: 0 })
    expect(out.player).toMatchObject({ name: 'New', clue_points: 0, streak_days: 0, referral_settled: false, free_case_day: null })
    expect(out).toMatchObject({ badges: [], seasonRewards: [], results: [] })
  })

  it('hashes the same doc the same way, so unchanged docs are skipped on a re-run', () => {
    expect(docHash(oldDoc)).toBe(docHash(structuredClone(oldDoc)))
    expect(docHash({ ...oldDoc, cluePoints: 311 })).not.toBe(docHash(oldDoc))
  })
})
