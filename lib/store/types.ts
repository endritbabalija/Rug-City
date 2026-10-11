import type { Season } from '../game/progress'
import type { CaseMode, CaseResultRow, CaseStartRow, CaseStats, ChatMessage, RoomState } from '../game/types'
import type { Player } from '../player'

export type PurchaseStatus = 'pending' | 'paid' | 'refunded'

export interface Purchase {
  id: string
  userId: number
  sku: string
  stars: number
  status: PurchaseStatus
  chargeId?: string
  createdAt: number
}

/** One player's standing in one season. Ties go to whoever reached the rating first. */
export interface SeasonRating {
  season: number
  playerId: number
  name: string
  badge?: string
  rating: number
  cases: number
  updatedAt: number
}

/** One product event (`lib/analytics.ts`). */
export interface AppEvent {
  name: string
  playerId: number | null
  props: Record<string, unknown>
  at: number
}

/** One `room_chats` row: a message in a player's private chat with a suspect. */
export interface ChatRow extends ChatMessage {
  roomCode: string
  playerId: number
  suspectId: string
  /** Position in this (room, player, suspect) thread, from 0. */
  seq: number
}

export type CaseStatus = 'draft' | 'review' | 'live' | 'retired'

/** One `cases` row without its case file: enough to decide whether the case can be played. */
export interface CaseMeta {
  id: string
  district: string
  status: CaseStatus
  /** Null: live as soon as its status is. */
  releaseAt: number | null
  version: number
}

/** A full `cases` row. `data` is unchecked JSON until `caseSchema` validates it. */
export interface CaseRow extends CaseMeta {
  data: unknown
}

export interface Store {
  getPlayer(id: number): Promise<Player | null>
  /** Inserts the player unless one with the same id exists; returns whichever is stored. */
  createPlayer(p: Player): Promise<Player>
  /** Read-modify-write with optimistic concurrency. `fn` may throw to abort. */
  updatePlayer(id: number, fn: (p: Player) => Player): Promise<Player>

  getBadges(playerId: number): Promise<string[]>
  addBadge(playerId: number, badge: string): Promise<void>
  removeBadge(playerId: number, badge: string): Promise<void>

  hasSeasonReward(season: number, playerId: number): Promise<boolean>
  /** Returns false if the player already had this season's reward, so it doubles as the claim. */
  addSeasonReward(season: number, playerId: number): Promise<boolean>

  /** Returns false if this player already has a result for this room. */
  insertCaseResult(row: CaseResultRow): Promise<boolean>
  /** Records that the player saw the case's clues. Returns false if they already had (in any room). */
  recordCaseStart(row: CaseStartRow): Promise<boolean>
  /** The player finished or started this case, in any room but `exceptRoom`. */
  hasPlayed(playerId: number, caseId: string, exceptRoom?: string): Promise<boolean>
  /** Every case id the player has finished or started. */
  playedCaseIds(playerId: number): Promise<string[]>
  /** Newest first. */
  recentResults(playerId: number, limit: number): Promise<CaseResultRow[]>
  /** Every rated score the player finished within the season. */
  seasonScores(playerId: number, season: Season): Promise<number[]>

  /** A player's suspect chats in one room, in order. */
  getChats(code: string, playerId: number): Promise<ChatRow[]>
  appendChat(row: ChatRow): Promise<void>
  /** Removes the newest message of one thread. */
  deleteLastChat(code: string, playerId: number, suspectId: string): Promise<void>

  getSeasons(): Promise<Season[]>

  /** Every row of the `cases` table, without the case files. */
  listCaseMeta(): Promise<CaseMeta[]>
  getCaseRow(id: string): Promise<CaseRow | null>
  /** Inserts or replaces a case row. */
  saveCase(row: CaseRow): Promise<void>

  getCaseStats(caseId: string, mode: CaseMode): Promise<CaseStats | null>
  /** Counts one finished room of a case in a mode, creating its row on the first play. */
  bumpPlays(caseId: string, mode: CaseMode): Promise<void>

  /** Returns false if the code is already taken. */
  createRoom(state: RoomState): Promise<boolean>
  getRoom(code: string): Promise<RoomState | null>
  updateRoom(code: string, fn: (s: RoomState) => RoomState): Promise<RoomState>

  createPurchase(p: Purchase): Promise<void>
  getPurchase(id: string): Promise<Purchase | null>
  getPurchaseByCharge(chargeId: string): Promise<Purchase | null>
  /** Atomically moves a purchase from `from` to `to`. Returns null if it wasn't in `from`. */
  transitionPurchase(id: string, from: PurchaseStatus, to: PurchaseStatus, chargeId?: string): Promise<Purchase | null>

  /**
   * Record a player's season rating. Ratings only ever go up within a season, so a write
   * never lowers what is stored: settles that finish out of order can't undo each other.
   */
  raiseSeasonRating(r: SeasonRating): Promise<void>
  /** Ranked players of a season, best first, from `offset`, plus how many are ranked in total. */
  getSeasonLeaderboard(season: number, limit: number, offset?: number): Promise<{ rows: SeasonRating[]; total: number }>
  /** 1-based position of a player in a season, or null if they aren't ranked. */
  getSeasonPosition(season: number, playerId: number): Promise<number | null>

  trackEvents(events: AppEvent[]): Promise<void>
  /** Every row of the feature flag table, by name. */
  getFlags(): Promise<Record<string, boolean>>
}

export class ConflictError extends Error {}

/** Retry a compare-and-swap a few times before giving up. */
export async function withRetries<T>(attempt: () => Promise<T | typeof CONFLICT>): Promise<T> {
  for (let i = 0; i < 6; i++) {
    const result = await attempt()
    if (result !== CONFLICT) return result
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 40 * (i + 1)))
  }
  throw new ConflictError('Too many concurrent updates, try again.')
}

export const CONFLICT = Symbol('conflict')
