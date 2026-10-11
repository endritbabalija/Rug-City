import { describe, expect, it } from 'vitest'
import { mooncat } from '@/lib/cases/mooncat'
import {
  CASE_MAX,
  caseScore,
  HELP_PENALTY,
  HELP_PENALTY_CAP,
  helpPenalty,
  MEDIAN_AFTER_PLAYS,
  NO_HELP,
  targetFor,
  timeScore,
} from '@/lib/game/scoring'
import type { CaseMode, CaseStats } from '@/lib/game/types'

const allRight = { culprit: true, motive: true, trail: true }

describe('helpPenalty', () => {
  it('is zero without help', () => {
    expect(helpPenalty(NO_HELP)).toBe(0)
  })

  it('adds up every use', () => {
    expect(helpPenalty({ ...NO_HELP, hint: 1 })).toBe(HELP_PENALTY.hint)
    expect(helpPenalty({ ...NO_HELP, trace: 2 })).toBe(0.3)
    expect(helpPenalty({ hint: 1, trace: 1, subpoena: 1, dexHint: 1 })).toBe(0.6)
  })

  it('stops at the cap', () => {
    expect(helpPenalty({ ...NO_HELP, subpoena: 3, hint: 1 })).toBe(0.85)
    expect(helpPenalty({ ...NO_HELP, subpoena: 4 })).toBe(HELP_PENALTY_CAP)
    expect(helpPenalty({ hint: 5, trace: 5, subpoena: 5, dexHint: 5 })).toBe(HELP_PENALTY_CAP)
  })
})

describe('timeScore', () => {
  it('gives full points up to the target, then slides to 0 at twice the target', () => {
    expect(timeScore(0, 900)).toBe(20)
    expect(timeScore(900, 900)).toBe(20)
    expect(timeScore(1125, 900)).toBe(15)
    expect(timeScore(1350, 900)).toBe(10)
    expect(timeScore(1800, 900)).toBe(0)
    expect(timeScore(5000, 900)).toBe(0)
  })
})

describe('caseScore', () => {
  it('scores a perfect, fast, clean solve at the maximum', () => {
    expect(caseScore(allRight, 300, 900, NO_HELP)).toEqual({ points: { culprit: 50, motive: 25, trail: 25, time: 20 }, penalty: 0, score: CASE_MAX })
  })

  it('only gives time points for the right culprit', () => {
    expect(caseScore({ ...allRight, culprit: false }, 60, 900, NO_HELP).score).toBe(50)
  })

  it('always ranks a clean solve above an aided one with the same answers and time', () => {
    const answers = [allRight, { ...allRight, motive: false }, { culprit: false, motive: true, trail: false }, { culprit: true, motive: false, trail: false }]
    const helps = [{ ...NO_HELP, hint: 1 }, { ...NO_HELP, dexHint: 1 }, { ...NO_HELP, trace: 1 }, { ...NO_HELP, subpoena: 3 }]
    for (const correct of answers)
      for (const elapsed of [60, 900, 1400, 1799])
        for (const help of helps) expect(caseScore(correct, elapsed, 900, NO_HELP).score).toBeGreaterThan(caseScore(correct, elapsed, 900, help).score)
  })

  it('cuts the score by the penalty', () => {
    expect(caseScore(allRight, 300, 900, { ...NO_HELP, trace: 1 })).toMatchObject({ penalty: 0.15, score: 102 })
  })
})

describe('targetFor', () => {
  const stats = (mode: CaseMode, plays: number): CaseStats => ({ caseId: mooncat.id, mode, plays, medianSec: 640, updatedAt: 0 })

  it("uses the case's own target until the mode has enough plays", () => {
    expect(targetFor(null, mooncat)).toBe(mooncat.targetSec)
    expect(targetFor(stats('solo', MEDIAN_AFTER_PLAYS - 1), mooncat)).toBe(mooncat.targetSec)
  })

  it('switches to the median at exactly 20 plays, per mode', () => {
    expect(MEDIAN_AFTER_PLAYS).toBe(20)
    expect(targetFor(stats('solo', 20), mooncat)).toBe(640)
    expect(targetFor(stats('crew', 19), mooncat)).toBe(mooncat.targetSec)
    expect(targetFor(stats('crew', 20), mooncat)).toBe(640)
  })

  it('keeps the case target while the weekly median has not been computed yet', () => {
    expect(targetFor({ plays: 50 }, mooncat)).toBe(mooncat.targetSec)
  })
})
