import type { CaseFile, Clue, Option, Tx, Wallet } from '../cases/types'
import { chatKey, cluesFor, questionsLeft, suspectsFor } from './engine'
import { ACCUSE_GRACE_MS, INVESTIGATE_MS, type ChatMessage, type FeedItem, type Phase, type RoomResult, type Vote } from './types'
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

export interface RoomView {
  code: string
  phase: Phase
  phaseStartedAt: number
  serverNow: number
  investigateEndsAt: number | null
  accuseGraceEndsAt: number | null
  me: { id: number; isHost: boolean; ready: boolean }
  hostId: number
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
  result: (RoomResult & { answer: Vote; reveal: string[] }) | null
}

export function buildView(state: RoomState, c: CaseFile, playerId: number, now: number): RoomView {
  const inCase = state.seats.includes(playerId)
  const revealed = state.phase === 'reveal'
  const myClueIds = inCase ? cluesFor(state, c, playerId) : []
  const mySuspects = inCase ? suspectsFor(state, c, playerId) : []
  const me = state.players.find((p) => p.id === playerId)

  const chats: RoomView['chats'] = {}
  for (const suspectId of mySuspects) {
    const suspect = c.suspects.find((s) => s.id === suspectId)!
    const key = chatKey(playerId, suspectId)
    const opener: ChatMessage = { from: 'suspect', text: suspect.opener, at: state.investigateStartedAt ?? state.phaseStartedAt }
    chats[suspectId] = { messages: [opener, ...(state.chats[key] ?? [])], subpoenaArmed: !!state.subpoenas[key] }
  }

  const wallets: ExplorerWallet[] = c.wallets.map(({ fundedBy, fundingHidden, ...w }) => {
    const visible = !fundingHidden || state.traced.includes(w.id) || revealed
    return { ...w, fundedBy: visible ? fundedBy : null, traceable: !visible }
  })

  return {
    code: state.code,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    serverNow: now,
    investigateEndsAt: state.investigateStartedAt ? state.investigateStartedAt + INVESTIGATE_MS : null,
    accuseGraceEndsAt: state.phase === 'accuse' ? state.phaseStartedAt + ACCUSE_GRACE_MS : null,
    me: { id: playerId, isHost: state.hostId === playerId, ready: !!me?.ready },
    hostId: state.hostId,
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
    myClues: myClueIds.map((id) => c.clues.find((cl) => cl.id === id)!),
    mySuspects,
    chats,
    questionsLeft: questionsLeft(state, playerId),
    explorer: { wallets, txs: c.txs },
    hints: c.hints.slice(0, revealed ? c.hints.length : state.hintsRevealed),
    feed: state.feed,
    myVote: state.votes[String(playerId)] ?? null,
    votesIn: Object.keys(state.votes).length,
    result: revealed && state.result ? { ...state.result, answer: c.answer, reveal: c.reveal } : null,
  }
}
