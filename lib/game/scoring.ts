// Case scores: accuracy, time against the case's target, and penalties for help.
// Pure functions, shared by the engine (the crew's verdict) and progress (each seat's rating).

import type { CaseFile } from '../cases/types'
import type { CaseStats, Help, RoomResult } from './types'

/** Share of the case score each use of help costs. They add up, capped at HELP_PENALTY_CAP. */
export const HELP_PENALTY: Record<keyof Help, number> = { hint: 0.1, trace: 0.15, subpoena: 0.25, dexHint: 0.1 }
export const HELP_PENALTY_CAP = 0.9
/** The penalty also cuts the case's Clue Points (culprit, motive, trail, speed), not just its rating. */
export const PENALIZE_CLUE_POINTS = true
/** Plays in one mode before a case's target time switches from its `targetSec` to the weekly median. */
export const MEDIAN_AFTER_PLAYS = 20

export const CASE_POINTS = { culprit: 50, motive: 25, trail: 25, time: 20 }
export const CASE_MAX = CASE_POINTS.culprit + CASE_POINTS.motive + CASE_POINTS.trail + CASE_POINTS.time

export const NO_HELP: Help = { hint: 0, trace: 0, subpoena: 0, dexHint: 0 }

/** The share of the case score the room's help costs, 0 to HELP_PENALTY_CAP. */
export function helpPenalty(help: Help) {
  const total = (Object.keys(HELP_PENALTY) as (keyof Help)[]).reduce((sum, k) => sum + (help[k] ?? 0) * HELP_PENALTY[k], 0)
  // Rounded to whole percents so 0.1 + 0.2 never shows up as 0.30000000000000004.
  return Math.min(HELP_PENALTY_CAP, Math.round(total * 100) / 100)
}

/** Full time points at or under the target, sliding to 0 at twice the target. */
export function timeScore(elapsedSec: number, targetSec: number) {
  if (elapsedSec <= targetSec) return CASE_POINTS.time
  return Math.max(0, Math.round((CASE_POINTS.time * (2 * targetSec - elapsedSec)) / targetSec))
}

/** Cut a score by a penalty share. */
export const applyPenalty = (n: number, penalty: number) => Math.round(n * (1 - penalty))

export function caseScore(correct: RoomResult['correct'], elapsedSec: number, targetSec: number, help: Help) {
  const points = {
    culprit: correct.culprit ? CASE_POINTS.culprit : 0,
    motive: correct.motive ? CASE_POINTS.motive : 0,
    trail: correct.trail ? CASE_POINTS.trail : 0,
    // Time only counts when the culprit was caught.
    time: correct.culprit ? timeScore(elapsedSec, targetSec) : 0,
  }
  const penalty = helpPenalty(help)
  return { points, penalty, score: applyPenalty(points.culprit + points.motive + points.trail + points.time, penalty) }
}

/** The target time for a case in one mode: its own `targetSec` until the median has enough plays behind it. */
export function targetFor(stats: Pick<CaseStats, 'plays' | 'medianSec'> | null, c: Pick<CaseFile, 'targetSec'>) {
  return stats && stats.plays >= MEDIAN_AFTER_PLAYS && stats.medianSec ? stats.medianSec : c.targetSec
}
