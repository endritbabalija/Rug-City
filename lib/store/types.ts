import type { RoomState } from '../game/types'
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

export interface Store {
  getPlayer(id: number): Promise<Player | null>
  /** Inserts the player unless one with the same id exists; returns whichever is stored. */
  createPlayer(p: Player): Promise<Player>
  /** Read-modify-write with optimistic concurrency. `fn` may throw to abort. */
  updatePlayer(id: number, fn: (p: Player) => Player): Promise<Player>

  /** Returns false if the code is already taken. */
  createRoom(state: RoomState): Promise<boolean>
  getRoom(code: string): Promise<RoomState | null>
  updateRoom(code: string, fn: (s: RoomState) => RoomState): Promise<RoomState>

  createPurchase(p: Purchase): Promise<void>
  getPurchase(id: string): Promise<Purchase | null>
  getPurchaseByCharge(chargeId: string): Promise<Purchase | null>
  /** Atomically moves a purchase from `from` to `to`. Returns null if it wasn't in `from`. */
  transitionPurchase(id: string, from: PurchaseStatus, to: PurchaseStatus, chargeId?: string): Promise<Purchase | null>
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
