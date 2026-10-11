import { dealClues, dealSuspects } from '../game/engine'
import type { CaseFile } from './types'

// Static checks every case must pass before review (the pipeline's first gate, and
// tests/cases.test.ts for the built-ins), plus the review report the pipeline stores
// with a drafted case in `data.review`.

/** Seat counts a crew case can be dealt to. */
export const SEAT_COUNTS = [3, 4, 5, 6] as const
/** Human counts suspects are dealt to: solo (1), a crew with Dex (2–5), a crew without him (3–6). */
export const HUMAN_COUNTS = [1, 2, 3, 4, 5, 6] as const

/** Everything wrong with a case's internal consistency; empty when it passes. */
export function staticProblems(c: CaseFile): string[] {
  const problems: string[] = []
  const clueIds = new Set(c.clues.map((cl) => cl.id))
  const suspectIds = new Set(c.suspects.map((s) => s.id))
  const walletIds = new Set(c.wallets.map((w) => w.id))
  const unique = (what: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) problems.push(`Duplicate ${what} ids`)
  }

  unique('clue', c.clues.map((cl) => cl.id))
  unique('suspect', c.suspects.map((s) => s.id))
  unique('wallet', c.wallets.map((w) => w.id))
  unique('tx', c.txs.map((t) => t.id))
  unique('motive', c.motives.map((m) => m.id))
  unique('trail', c.trails.map((t) => t.id))

  if ([...c.dealOrder].sort().join() !== [...clueIds].sort().join()) problems.push('dealOrder must list every clue id exactly once')
  if (!Number.isInteger(c.targetSec) || c.targetSec <= 0) problems.push('targetSec must be a positive whole number')
  if (!suspectIds.has(c.answer.culprit)) problems.push(`answer.culprit "${c.answer.culprit}" is not a suspect id`)
  if (!c.motives.some((m) => m.id === c.answer.motive)) problems.push(`answer.motive "${c.answer.motive}" is not a motive id`)
  if (!c.trails.some((t) => t.id === c.answer.trail)) problems.push(`answer.trail "${c.answer.trail}" is not a trail id`)
  if (c.suspects.length < 3) problems.push('Needs at least 3 suspects (the culprit and two red herrings)')
  for (const t of c.txs) {
    if (!walletIds.has(t.from)) problems.push(`tx ${t.id}: unknown wallet "${t.from}"`)
    if (!walletIds.has(t.to)) problems.push(`tx ${t.id}: unknown wallet "${t.to}"`)
  }
  if (!c.culpritProofs.length) problems.push('Needs at least one culprit proof')
  for (const proof of c.culpritProofs) {
    if (proof.length < 2) problems.push(`Culprit proof ${proof.join('+')} must need at least two clues`)
    for (const id of proof) if (!clueIds.has(id)) problems.push(`Culprit proof uses unknown clue "${id}"`)
  }

  for (const n of HUMAN_COUNTS) {
    const suspectHands = dealSuspects(c, n)
    if (suspectHands.some((h) => h.length === 0)) problems.push(`${n} humans: a player gets no suspect`)
    if (new Set(suspectHands.flat()).size !== suspectIds.size) problems.push(`${n} humans: a suspect talks to nobody`)
  }
  for (const n of SEAT_COUNTS) {
    const hands = dealClues(c, n)
    if (hands.some((h) => h.length === 0)) problems.push(`${n} seats: a player gets no clue`)
    // A crew without Dex: every seat is human.
    if (dealSuspects(c, n).some((h) => h.length > 2)) problems.push(`${n} seats: a player gets more than two suspects`)
    hands.forEach((hand, seat) => {
      for (const proof of c.culpritProofs)
        if (proof.every((id) => hand.includes(id))) problems.push(`${n} seats: seat ${seat + 1} alone holds the proof ${proof.join('+')}`)
    })
  }
  return problems
}

/** Starting target time: 60 s per clue plus 90 s per suspect, to the nearest minute. Adjusted in review. */
export function suggestTargetSec(c: Pick<CaseFile, 'clues' | 'suspects'>) {
  return Math.round((60 * c.clues.length + 90 * c.suspects.length) / 60) * 60
}

export type Question = 'culprit' | 'motive' | 'trail'

/** One blind-solver answer and how it was judged. */
export interface SolverRun {
  /** What the solver saw, e.g. "all clues + interrogation" or "4 seats, hand 2". */
  label: string
  culprit: string
  motive: string
  trail: string
  confidence: 'low' | 'medium' | 'high'
  reasoning: string
  correct: Record<Question, boolean>
  pass: boolean
}

/** The pipeline's report on a case, stored in `data.review`. */
export interface CaseReview {
  checkedAt: number
  draftModel?: string
  solverModel: string
  /** The crime type the draft was asked for. */
  crime?: string
  staticProblems: string[]
  /**
   * No clues, no chats, explorer untraced: must not get all three right, nor name the
   * culprit with more than low confidence. Missing on reports from before this check.
   */
  publicOnly?: SolverRun[]
  /** All clues, explorer and suspects' confessions: must get all three right. */
  full: SolverRun[]
  /** All clues and explorer, no suspect chats: must miss at least one. */
  noChats: SolverRun[]
  /** One seat's hand each: must not name the culprit with high confidence. */
  hands: SolverRun[]
  /** What the no-chat solver missed, i.e. what only interrogation gives up. */
  needsInterrogation: Question[]
  suggestedTargetSec: number
  passed: boolean
  failures: string[]
  /** Set when an admin rejects the case. */
  rejected?: { at: number; reason?: string }
}
