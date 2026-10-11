// In-process store for local development and tests. Data is lost on restart and
// is not shared between serverless instances, so production must use Supabase.

import type { Run } from '../investigation/types'
import type { Player } from '../player'
import type { AppEvent, Store } from './types'

const clone = <T,>(v: T): T => structuredClone(v)

export function createMemoryStore(): Store {
  const players = new Map<number, Player>()
  const runs = new Map<string, Run>()
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

    async createRun(run) {
      if (!runs.has(run.id)) runs.set(run.id, clone(run))
      return clone(runs.get(run.id)!)
    },
    async getRun(id) {
      const r = runs.get(id)
      return r ? clone(r) : null
    },
    async getLatestRun(playerId, caseId) {
      // Map order is insertion order, so the last match is the newest.
      let latest: Run | null = null
      for (const r of runs.values()) if (r.ownerId === playerId && r.caseId === caseId) latest = r
      return latest ? clone(latest) : null
    },
    async updateRun(id, fn) {
      const current = runs.get(id)
      if (!current) throw new Error(`Run ${id} not found`)
      const next = fn(clone(current))
      if (!next) return clone(current)
      runs.set(id, clone(next))
      return clone(next)
    },

    async trackEvents(batch) {
      events.push(...clone(batch))
    },
    async getFlags() {
      return { ...flags }
    },
  }
}
