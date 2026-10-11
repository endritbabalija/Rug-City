import type { CaseFile, Clue, Option, Tx, Wallet } from '../cases/types'
import { dexHand, dexHintsLeft, dexNextReleaseAt, dexReleaseAt, dexReleased, hasDex } from './dex'
import { chatKey, cluesFor, countCorrect, questionsLeft, roomMode, suspectsFor } from './engine'
import { NO_HELP } from './scoring'
import {
  ACCUSE_GRACE_MS,
  DEX_ID,
  INVESTIGATE_MS,
  type Award,
  type CaseMode,
  type ChatMessage,
  type DexMessage,
  type FeedItem,
  type Phase,
  type RoomResult,
  type Vote,
} from './types'
import type { RoomState } from './types'

export interface PublicSuspect {
  id: string
  name: string
  handle: string
  archetype: string
  avatar: string
  blurb: string
  cover: string
}

export interface ExplorerWallet extends Omit<Wallet, 'fundedBy' | 'fundingHidden'> {
  fundedBy: string | null
  traceable: boolean
}

/** Dex's opener, shown before anything he has said in the room. */
export const DEX_OPENER = "Dex here. I've got my own pile of evidence on this one. Ask and I'll show you, one piece at a time."
/** His opener in a crew, where his clues come out on a timer. */
export const DEX_CREW_OPENER = "Dex here. I'll put my notes on the table for the crew as I go. Shout if you need a hint."

export interface RoomView {
  code: string
  mode: CaseMode
  phase: Phase
  phaseStartedAt: number
  serverNow: number
  investigateEndsAt: number | null
  accuseGraceEndsAt: number | null
  me: { id: number; isHost: boolean; ready: boolean }
  hostId: number
  /** Dex has a seat in this crew (set in the lobby by the host). */
  dexSeated: boolean
  players: { id: number; name: string; badge?: string; ready: boolean; voted: boolean }[]
  case: {
    id: string
    title: string
    crime: string
    tagline: string
    project: CaseFile['project']
    briefing: string[]
    timeline: CaseFile['timeline']
    suspects: PublicSuspect[]
    motives: Option[]
    trails: Option[]
    hintCount: number
  }
  myClues: Clue[]
  mySuspects: string[]
  chats: Record<string, { messages: ChatMessage[]; subpoenaArmed: boolean }>
  questionsLeft: number
  explorer: { wallets: ExplorerWallet[]; txs: Tx[] }
  hints: string[]
  feed: FeedItem[]
  myVote: Vote | null
  votesIn: number
  /**
   * Dex's corner in rooms where he has a seat: everything he has shared. Solo, he shares when
   * asked; in a crew his clues go public on a timer (`nextReleaseAt`) and his lines are hints.
   */
  dex: {
    shared: Clue[]
    messages: (Pick<DexMessage, 'text' | 'at' | 'hint'> & { clue?: Clue })[]
    cluesLeft: number
    hintsLeft: number
    nextReleaseAt: number | null
  } | null
  result:
    | (RoomResult & {
        answer: Vote
        reveal: string[]
        /** Everyone's own vote, shown once the case is over. */
        crew: { id: number; name: string; badge?: string; vote: Vote | null; correct: number }[]
        /** What this player earned; null until the room has settled. */
        myAward: Award | null
        settled: boolean
      })
    | null
}

const clueOf = (c: CaseFile, id: string) => c.clues.find((cl) => cl.id === id)!

/** `chats` is this player's `room_chats` messages in this room, by suspect id. */
export function buildView(state: RoomState, c: CaseFile, playerId: number, now: number, chats: Record<string, ChatMessage[]>): RoomView {
  const inCase = state.seats.includes(playerId)
  const revealed = state.phase === 'reveal'
  const myClueIds = inCase ? cluesFor(state, c, playerId) : []
  const mySuspects = inCase ? suspectsFor(state, c, playerId) : []
  const me = state.players.find((p) => p.id === playerId)

  const threads: RoomView['chats'] = {}
  for (const suspectId of mySuspects) {
    const suspect = c.suspects.find((s) => s.id === suspectId)!
    const opener: ChatMessage = { from: 'suspect', text: suspect.opener, at: state.investigateStartedAt ?? state.phaseStartedAt }
    threads[suspectId] = { messages: [opener, ...(chats[suspectId] ?? [])], subpoenaArmed: !!state.subpoenas[chatKey(playerId, suspectId)] }
  }

  const crewDex = roomMode(state) === 'crew' && hasDex(state)
  const released = dexReleased(state, c, now)
  const dexShared = crewDex ? released : (state.dexShared ?? [])
  // Crew releases aren't stored: each one becomes a feed line at its release time.
  const releaseLines: FeedItem[] = released.map((id, i) => ({
    at: dexReleaseAt(state.investigateStartedAt!, i),
    playerId: DEX_ID,
    text: `Dex shared a note: "${clueOf(c, id).title}".`,
  }))
  const feed = releaseLines.length ? [...state.feed, ...releaseLines].sort((a, b) => a.at - b.at) : state.feed

  const wallets: ExplorerWallet[] = c.wallets.map(({ fundedBy, fundingHidden, ...w }) => {
    const visible = !fundingHidden || state.traced.includes(w.id) || revealed
    return { ...w, fundedBy: visible ? fundedBy : null, traceable: !visible }
  })

  return {
    code: state.code,
    mode: roomMode(state),
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    serverNow: now,
    investigateEndsAt: state.investigateStartedAt ? state.investigateStartedAt + INVESTIGATE_MS : null,
    accuseGraceEndsAt: state.phase === 'accuse' ? state.phaseStartedAt + ACCUSE_GRACE_MS : null,
    me: { id: playerId, isHost: state.hostId === playerId, ready: !!me?.ready },
    hostId: state.hostId,
    dexSeated: hasDex(state) || !!state.dexSeated,
    players: state.players.map((p) => ({ id: p.id, name: p.name, badge: p.badge, ready: p.ready, voted: !!state.votes[String(p.id)] })),
    case: {
      id: c.id,
      title: c.title,
      crime: c.crime,
      tagline: c.tagline,
      project: c.project,
      briefing: c.briefing,
      timeline: c.timeline,
      suspects: c.suspects.map(({ id, name, handle, archetype, avatar, blurb, cover }) => ({ id, name, handle, archetype, avatar, blurb, cover })),
      motives: c.motives,
      trails: c.trails,
      hintCount: c.hints.length,
    },
    myClues: myClueIds.map((id) => clueOf(c, id)),
    mySuspects,
    chats: threads,
    questionsLeft: questionsLeft(state, playerId),
    explorer: { wallets, txs: c.txs },
    hints: c.hints.slice(0, revealed ? c.hints.length : state.hintsRevealed),
    feed,
    myVote: state.votes[String(playerId)] ?? null,
    votesIn: Object.keys(state.votes).length,
    dex:
      hasDex(state) && inCase
        ? {
            shared: dexShared.map((id) => clueOf(c, id)),
            messages: [
              { text: crewDex ? DEX_CREW_OPENER : DEX_OPENER, at: state.investigateStartedAt ?? state.phaseStartedAt },
              ...(state.dexMessages ?? []).map(({ text, at, clueId, hint }) => ({ text, at, hint, clue: clueId ? clueOf(c, clueId) : undefined })),
            ],
            cluesLeft: dexHand(state, c).length - dexShared.length,
            hintsLeft: dexHintsLeft(state, c),
            nextReleaseAt: dexNextReleaseAt(state, c, now),
          }
        : null,
    result:
      revealed && state.result
        ? {
            ...state.result,
            // Results from before help penalties have no help, penalty or target.
            help: { ...NO_HELP, ...state.result.help },
            penalty: state.result.penalty ?? 0,
            targetSec: state.result.targetSec ?? c.targetSec,
            answer: c.answer,
            reveal: c.reveal,
            crew: state.players
              .filter((p) => state.seats.includes(p.id))
              .map((p) => {
                const vote = state.votes[String(p.id)] ?? null
                return { id: p.id, name: p.name, badge: p.badge, vote, correct: vote ? countCorrect(c, vote) : 0 }
              }),
            myAward: state.awards?.[String(playerId)] ?? null,
            /** Points are settled; a missing award then means none was recorded (e.g. a pre-points room). */
            settled: !!state.awards,
          }
        : null,
  }
}
