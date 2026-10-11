// Detective Dex, the AI partner in solo cases. Pure rules like engine.ts: he holds a seat's
// clues and hints, and hands them over when the player asks. His lines come from lib/ai/dex.ts.

import type { CaseFile } from '../cases/types'
import { addHelp, cluesFor, GameError, log, requireMember, requirePhase, roomHelp } from './engine'
import { DEX_ID, type DexMessage, type RoomState } from './types'

/** Hints Dex gives per case, free of items. Each still carries the Dex hint penalty; shop Hints work after that. */
export const DEX_FREE_HINTS = 2
/** Dex messages a room keeps. */
const MAX_DEX_MESSAGES = 40

export type DexAsk = DexMessage['ask']

export const hasDex = (state: RoomState) => state.seats.includes(DEX_ID)

/** The clues dealt to Dex's seat. */
export function dexHand(state: RoomState, c: CaseFile): string[] {
  return cluesFor(state, c, DEX_ID)
}

export function dexHintsLeft(state: RoomState, c: CaseFile) {
  return Math.max(0, Math.min(DEX_FREE_HINTS - roomHelp(state).dexHint, c.hints.length - state.hintsRevealed))
}

function requireDex(state: RoomState, actorId: number) {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  if (!hasDex(state)) throw new GameError('NO_DEX', "Dex isn't on this case.", 409)
}

/** Dex shows the player his next unshared clue. Free. */
export function shareNextClue(state: RoomState, c: CaseFile, actorId: number, now: number): { state: RoomState; clueId: string } {
  requireDex(state, actorId)
  const shared = state.dexShared ?? []
  const clueId = dexHand(state, c).find((id) => !shared.includes(id))
  if (!clueId) throw new GameError('DEX_OUT_OF_CLUES', 'Dex has shown you everything he has.', 409)
  return { state: log({ ...state, dexShared: [...shared, clueId] }, DEX_ID, 'Dex shared a clue.', now), clueId }
}

/** Dex reveals the case's next hint, counted as a Dex hint for the penalty. */
export function dexHint(state: RoomState, c: CaseFile, actorId: number, now: number): { state: RoomState; hint: string } {
  requireDex(state, actorId)
  if (state.hintsRevealed >= c.hints.length) throw new GameError('NO_MORE_HINTS', 'All hints for this case are already revealed.', 409)
  if (dexHintsLeft(state, c) <= 0) throw new GameError('DEX_OUT_OF_HINTS', "Dex is out of hints. A Hint from your kit still works.", 409)
  const hint = c.hints[state.hintsRevealed]
  return { state: log({ ...addHelp(state, 'dexHint'), hintsRevealed: state.hintsRevealed + 1 }, DEX_ID, 'Dex gave a hint.', now), hint }
}

/** Record one of Dex's lines. */
export function dexSay(state: RoomState, message: DexMessage): RoomState {
  return { ...state, dexMessages: [...(state.dexMessages ?? []), message].slice(-MAX_DEX_MESSAGES) }
}
