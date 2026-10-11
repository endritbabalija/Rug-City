// In-process store for local development and tests. Data is lost on restart and
// is not shared between serverless instances, so production must use Supabase.

import type { Player } from '../player'
import type { AppEvent, Store } from './types'

const clone = <T,>(v: T): T => structuredClone(v)

export function createMemoryStore(): Store {
  const players = new Map<number, Player>()
  const events: AppEvent[] = []
  const flags: Record<string, boolean> = {}

  return {
    async getPlayer(id) {
      const p = players.get(id)
      return p ? clone(p) : null
    },
    async createPlayer(p) {
      if (!players.has(p.id)) players.set(p.id, clone(p))
      return clone(players.get(p.id)!)
    },
    async updatePlayer(id, fn) {
      const current = players.get(id)
      if (!current) throw new Error(`Player ${id} not found`)
      const next = fn(clone(current))
      players.set(id, clone(next))
      return next
    },

    async trackEvents(batch) {
      events.push(...clone(batch))
    },
    async getFlags() {
      return { ...flags }
    },
  }
}
