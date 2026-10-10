export type Phase = 'lobby' | 'briefing' | 'investigate' | 'accuse' | 'reveal'

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6
/** Suggested investigation time; after it runs out, anyone can call the vote. */
export const INVESTIGATE_MS = 12 * 60 * 1000
/** After this long in the vote, anyone can close it with the votes that are in. */
export const ACCUSE_GRACE_MS = 3 * 60 * 1000
/** Live interrogation questions each player gets per case (Subpoena answers are extra). */
export const QUESTIONS_PER_PLAYER = 6

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

export interface RoomResult {
  group: Vote
  correct: { culprit: boolean; motive: boolean; trail: boolean }
  points: { culprit: number; motive: number; trail: number; time: number }
  score: number
  elapsedSec: number
}

export interface RoomState {
  code: string
  caseId: string
  hostId: number
  createdAt: number
  phase: Phase
  phaseStartedAt: number
  players: RoomPlayer[]
  /** Seat order is fixed when the case starts and drives the clue deal. */
  seats: number[]
  /** key `${playerId}:${suspectId}` */
  chats: Record<string, ChatMessage[]>
  questionsUsed: Record<string, number>
  /** key `${playerId}:${suspectId}` -> the next answer from that suspect must be truthful */
  subpoenas: Record<string, boolean>
  traced: string[]
  hintsRevealed: number
  feed: FeedItem[]
  votes: Record<string, Vote>
  investigateStartedAt?: number
  result?: RoomResult
  /** Players whose referral rewards were already settled by this room. */
  rewardsSettled?: boolean
}
