// Detective Dex, the AI partner. Pure rules like engine.ts: he holds a seat's clues and hints.
// Solo, he hands a clue over when the player asks; in a crew he releases them to everyone on a
// timer and never votes. His lines come from lib/ai/dex.ts.

import type { CaseFile } from '../cases/types'
import { addHelp, cluesFor, GameError, log, nameOf, requireMember, requirePhase, roomHelp, roomMode, seatsTaken } from './engine'
import { CASE_POINTS } from './scoring'
import { DEX_ID, MAX_PLAYERS, QUESTIONS_PER_PLAYER, type DexMessage, type Phase, type RoomState, type TutorialStep } from './types'

/** Hints Dex gives per case, free of items. Each still carries the Dex hint penalty; shop Hints work after that. */
export const DEX_FREE_HINTS = 2
/** Dex messages a room keeps. */
const MAX_DEX_MESSAGES = 40
/** In a crew, Dex releases his first clue this long into the investigation, then one more every `everyMs`. */
export const DEX_RELEASE_SCHEDULE = { firstMs: 30_000, everyMs: 2 * 60_000 }

export type DexAsk = DexMessage['ask']

/** A new player's first case, played solo with Dex's tips on. No separate tutorial case (DEFAULTS.md → Tutorial). */
export const TUTORIAL_CASE_ID = 'mooncat-exit'

/** Dex's one scripted tip at each tutorial step. Static, no AI call. */
export const TUTORIAL_TIPS: Record<TutorialStep, string> = {
  briefing:
    "First case? Good, I like fresh eyes. Read the file top to bottom: the pitch, the timeline, the suspects. Note anything that sounds too convenient. When you're done, tap Start investigating and we split the evidence.",
  clue: "These are your clues. I'm holding the rest: ask me in the Dex tab and I'll hand them over one at a time. Watch for names, times and wallets that turn up in more than one place.",
  explorer:
    "This is the chain. Wallets up top, transactions below. Follow the money out of the project's wallet and see where it lands. A wallet with a hidden source needs a Trace, and that costs some score.",
  chat: `Suspects message you privately. You get ${QUESTIONS_PER_PLAYER} questions, so ask about something a clue contradicts. They lie to cover themselves: check every answer against the evidence.`,
  vote: `Three calls: who did it, why, and where the money went. Each scores on its own: ${CASE_POINTS.culprit} for the culprit, ${CASE_POINTS.motive} each for motive and trail, plus up to ${CASE_POINTS.time} for speed. Lock it in when you're sure.`,
}

/** The phase each tutorial step happens in. */
const TUTORIAL_PHASE: Record<TutorialStep, Phase> = { briefing: 'briefing', clue: 'investigate', explorer: 'investigate', chat: 'investigate', vote: 'accuse' }

export const hasDex = (state: RoomState) => state.seats.includes(DEX_ID)

/** The clues dealt to Dex's seat. */
export function dexHand(state: RoomState, c: CaseFile): string[] {
  return cluesFor(state, c, DEX_ID)
}

export function dexHintsLeft(state: RoomState, c: CaseFile) {
  return Math.max(0, Math.min(DEX_FREE_HINTS - roomHelp(state).dexHint, c.hints.length - state.hintsRevealed))
}

// ── Crew lobby ─────────────────────────────────────────────────────────────

function requireHostInLobby(state: RoomState, actorId: number) {
  requirePhase(state, 'lobby')
  if (roomMode(state) !== 'crew') throw new GameError('WRONG_PHASE', 'That is not possible right now.', 409)
  if (actorId !== state.hostId) throw new GameError('HOST_ONLY', 'Only the host can seat Dex.', 403)
}

/** The host gives Dex a seat in the crew. He counts toward MAX_PLAYERS. */
export function addDex(state: RoomState, actorId: number, now: number): RoomState {
  requireHostInLobby(state, actorId)
  if (state.dexSeated) throw new GameError('DEX_SEATED', 'Dex is already on this case.', 409)
  if (seatsTaken(state) >= MAX_PLAYERS) throw new GameError('ROOM_FULL', `This case already has ${MAX_PLAYERS} detectives.`, 409)
  return log({ ...state, dexSeated: true }, DEX_ID, 'Dex joined the case.', now)
}

export function removeDex(state: RoomState, actorId: number, now: number): RoomState {
  requireHostInLobby(state, actorId)
  if (!state.dexSeated) throw new GameError('NO_DEX', "Dex isn't on this case.", 409)
  return log({ ...state, dexSeated: false }, DEX_ID, 'Dex left.', now)
}

// ── Crew clue release ──────────────────────────────────────────────────────

/** When Dex's clue number `index` (0-based) goes public, by DEX_RELEASE_SCHEDULE. */
export function dexReleaseAt(investigateStartedAt: number, index: number) {
  return investigateStartedAt + DEX_RELEASE_SCHEDULE.firstMs + index * DEX_RELEASE_SCHEDULE.everyMs
}

/** Dex's clues the whole crew can see at `now`, in release order. Empty outside crew rooms with Dex. */
export function dexReleased(state: RoomState, c: CaseFile, now: number): string[] {
  const started = state.investigateStartedAt
  if (roomMode(state) !== 'crew' || !hasDex(state) || started === undefined) return []
  return dexHand(state, c).filter((_, i) => dexReleaseAt(started, i) <= now)
}

/** When Dex's next clue goes public, or null if he has none left (or isn't releasing). */
export function dexNextReleaseAt(state: RoomState, c: CaseFile, now: number): number | null {
  const started = state.investigateStartedAt
  if (roomMode(state) !== 'crew' || !hasDex(state) || started === undefined) return null
  const next = dexReleased(state, c, now).length
  return next < dexHand(state, c).length ? dexReleaseAt(started, next) : null
}

// ── Tutorial ───────────────────────────────────────────────────────────────

/** The player reached a tutorial step, so Dex's tip for it is given. Reaching it again returns the same state. */
export function reachTutorialStep(state: RoomState, actorId: number, step: TutorialStep, now: number): RoomState {
  requireMember(state, actorId)
  if (!state.tutorial) throw new GameError('NOT_TUTORIAL', 'This case has no tutorial.', 409)
  requirePhase(state, TUTORIAL_PHASE[step])
  const steps = state.tutorialSteps ?? []
  if (steps.some((s) => s.step === step)) return state
  return { ...state, tutorialSteps: [...steps, { step, at: now }] }
}

// ── Asking Dex ─────────────────────────────────────────────────────────────

function requireDex(state: RoomState, actorId: number) {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  if (!hasDex(state)) throw new GameError('NO_DEX', "Dex isn't on this case.", 409)
}

/** Solo: Dex shows the player his next unshared clue. Free. */
export function shareNextClue(state: RoomState, c: CaseFile, actorId: number, now: number): { state: RoomState; clueId: string } {
  requireDex(state, actorId)
  if (roomMode(state) === 'crew') throw new GameError('DEX_ON_TIMER', 'Dex shares his notes with the whole crew as he goes.', 409)
  const shared = state.dexShared ?? []
  const clueId = dexHand(state, c).find((id) => !shared.includes(id))
  if (!clueId) throw new GameError('DEX_OUT_OF_CLUES', 'Dex has shown you everything he has.', 409)
  return { state: log({ ...state, dexShared: [...shared, clueId] }, DEX_ID, 'Dex shared a clue.', now), clueId }
}

/** Dex reveals the case's next hint to the room, counted as a Dex hint for the room-wide penalty. Any player can ask. */
export function dexHint(state: RoomState, c: CaseFile, actorId: number, now: number): { state: RoomState; hint: string } {
  requireDex(state, actorId)
  if (state.hintsRevealed >= c.hints.length) throw new GameError('NO_MORE_HINTS', 'All hints for this case are already revealed.', 409)
  if (dexHintsLeft(state, c) <= 0) throw new GameError('DEX_OUT_OF_HINTS', "Dex is out of hints. A Hint from your kit still works.", 409)
  const hint = c.hints[state.hintsRevealed]
  return { state: log({ ...addHelp(state, 'dexHint'), hintsRevealed: state.hintsRevealed + 1 }, DEX_ID, `${nameOf(state, actorId)} asked Dex for a hint.`, now), hint }
}

/** Record one of Dex's lines. */
export function dexSay(state: RoomState, message: DexMessage): RoomState {
  return { ...state, dexMessages: [...(state.dexMessages ?? []), message].slice(-MAX_DEX_MESSAGES) }
}
