export type Phase = 'lobby' | 'briefing' | 'investigate' | 'accuse' | 'reveal'

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6
/** Suggested investigation time; after it runs out, anyone can call the vote. */
export const INVESTIGATE_MS = 12 * 60 * 1000
/** After this long in the briefing, anyone in the case can start the investigation. */
export const BRIEFING_GRACE_MS = 3 * 60 * 1000
/** After this long in the vote, anyone can close it with the votes that are in. */
export const ACCUSE_GRACE_MS = 3 * 60 * 1000
/** Live interrogation questions each player gets per case (Subpoena answers are extra). */
export const QUESTIONS_PER_PLAYER = 6
/** Detective Dex's seat id. Telegram ids are positive, so it can't collide with a player. */
export const DEX_ID = 0
/** Humans a crew needs when Dex takes a seat. */
export const MIN_HUMANS_WITH_DEX = 2

export interface RoomPlayer {
  id: number
  name: string
  badge?: string
  ready: boolean
  joinedAt: number
}

export interface ChatMessage {
  from: 'player' | 'suspect'
  text: string
  at: number
  subpoena?: boolean
}

/** Something Dex said: banter around a clue or hint he shared. */
export interface DexMessage {
  ask: 'clue' | 'hint'
  text: string
  at: number
  /** The clue he handed over, or the hint he gave, with this line. */
  clueId?: string
  hint?: string
}

export interface FeedItem {
  at: number
  playerId: number
  text: string
}

export interface Vote {
  culprit: string
  motive: string
  trail: string
}

export type CaseMode = 'solo' | 'crew'

/** How many times the room used each kind of help. Every use lowers every seat's case score. */
export interface Help {
  hint: number
  trace: number
  subpoena: number
  dexHint: number
}

export interface RoomResult {
  group: Vote
  correct: { culprit: boolean; motive: boolean; trail: boolean }
  /** Points before the help penalty. */
  points: { culprit: number; motive: number; trail: number; time: number }
  /** Share of the score the room's help cost (0 to HELP_PENALTY_CAP). */
  penalty: number
  /** After the penalty. */
  score: number
  elapsedSec: number
  /** The time the case was scored against. */
  targetSec: number
  help: Help
}

/** One `case_stats` row: how a case plays in one mode. */
export interface CaseStats {
  caseId: string
  mode: CaseMode
  targetSec?: number
  /** Median solve time, recalculated weekly (slice 10). */
  medianSec?: number
  minSec?: number
  plays: number
  updatedAt: number
}

export interface RoomState {
  code: string
  caseId: string
  /** Missing on rooms created before solo rooms existed: those are 'crew'. */
  mode?: CaseMode
  /** An admin's free test of a case in review: no charge, no points, no result row. */
  playtest?: boolean
  hostId: number
  createdAt: number
  phase: Phase
  phaseStartedAt: number
  players: RoomPlayer[]
  /** The host added Dex to this crew's lobby (crew rooms only; solo rooms always seat him). */
  dexSeated?: boolean
  /** Seat order is fixed when the case starts and drives the clue deal. */
  seats: number[]
  /** key `${playerId}:${suspectId}` -> a question is waiting for its answer. The messages are `room_chats` rows. */
  awaiting?: Record<string, true>
  questionsUsed: Record<string, number>
  /** key `${playerId}:${suspectId}` -> the next answer from that suspect must be truthful */
  subpoenas: Record<string, boolean>
  traced: string[]
  hintsRevealed: number
  /** Dex's clues he has shown the player, in order (solo rooms; crews get his clues on a timer). */
  dexShared?: string[]
  dexMessages?: DexMessage[]
  /** Missing on rooms created before help penalties. */
  help?: Help
  feed: FeedItem[]
  votes: Record<string, Vote>
  investigateStartedAt?: number
  result?: RoomResult
  /** Players whose referral rewards were already settled by this room. */
  rewardsSettled?: boolean
  /** Clue Points each seat earned, written once when the room settles. key = player id */
  awards?: Record<string, Award>
}

/** Why a finished case earned no Clue Points. */
export type Unrated = 'no-vote' | 'replay' | 'daily-cap'

export interface Award {
  unrated?: Unrated
  points: { culprit: number; motive: number; trail: number; crew: number; speed: number; streak: number }
  total: number
  /** This case's score toward the season rating, when it counted. */
  rating?: number
  streakDays: number
  /** New rank title, when this case pushed the player over a threshold. */
  rankUp?: string
}

/** One `case_starts` row: the first room in which a player saw a case's clues. */
export interface CaseStartRow {
  playerId: number
  caseId: string
  roomCode: string
  at: number
}

/** One `case_results` row: one player's finished room. */
export interface CaseResultRow {
  roomCode: string
  playerId: number
  caseId: string
  /** 'legacy' marks rows rebuilt from old player docs by scripts/backfill-v2.mjs. */
  mode: 'crew' | 'solo' | 'legacy'
  seats: number
  /** How many of culprit / motive / trail this player got right. */
  correct: number
  /** This player's own case score (0 without a vote). */
  score: number
  points: Award['points']
  total: number
  /** This case's score toward the season rating, when it counted. */
  rating?: number
  elapsedSec?: number
  unrated?: string
  at: number
}
