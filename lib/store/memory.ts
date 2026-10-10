// In-process store for local development and tests. Data is lost on restart and
// is not shared between serverless instances, so production must use Supabase.

import type { RoomState } from '../game/types'
import type { Player } from '../player'
import type { Purchase, PurchaseStatus, Store } from './types'

const clone = <T,>(v: T): T => structuredClone(v)

export function createMemoryStore(): Store {
  const players = new Map<number, Player>()
  const rooms = new Map<string, RoomState>()
  const purchases = new Map<string, Purchase>()

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

    async createRoom(state) {
      if (rooms.has(state.code)) return false
      rooms.set(state.code, clone(state))
      return true
    },
    async getRoom(code) {
      const r = rooms.get(code)
      return r ? clone(r) : null
    },
    async updateRoom(code, fn) {
      const current = rooms.get(code)
      if (!current) throw new Error(`Room ${code} not found`)
      const next = fn(clone(current))
      rooms.set(code, clone(next))
      return next
    },

    async createPurchase(p) {
      purchases.set(p.id, clone(p))
    },
    async getPurchase(id) {
      const p = purchases.get(id)
      return p ? clone(p) : null
    },
    async getPurchaseByCharge(chargeId) {
      for (const p of purchases.values()) if (p.chargeId === chargeId) return clone(p)
      return null
    },
    async transitionPurchase(id: string, from: PurchaseStatus, to: PurchaseStatus, chargeId?: string) {
      const p = purchases.get(id)
      if (!p || p.status !== from) return null
      const next = { ...p, status: to, chargeId: chargeId ?? p.chargeId }
      purchases.set(id, next)
      return clone(next)
    },
  }
}
