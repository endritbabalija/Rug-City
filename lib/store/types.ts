import type { Player } from '../player'

/** One product event (`lib/analytics.ts`). */
export interface AppEvent {
  name: string
  playerId: number | null
  props: Record<string, unknown>
  at: number
}

export interface Store {
  getPlayer(id: number): Promise<Player | null>
  /** Inserts the player unless one with the same id exists; returns whichever is stored. */
  createPlayer(p: Player): Promise<Player>
  /** Read-modify-write with optimistic concurrency. `fn` may throw to abort. */
  updatePlayer(id: number, fn: (p: Player) => Player): Promise<Player>

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
