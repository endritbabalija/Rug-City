// In-process store for local development and tests. Data is lost on restart and
// is not shared between serverless instances, so production must use Supabase.

import type { Season } from '../game/progress'
import type { CaseResultRow, CaseStats, RoomState } from '../game/types'
import type { Player } from '../player'
import type { AppEvent, CaseRow, ChatRow, Purchase, PurchaseStatus, SeasonRating, Store } from './types'

const clone = <T,>(v: T): T => structuredClone(v)

const DAY = 86_400_000
const season = (id: number, start: number, days: number): Season => ({ id, start, end: start + days * DAY })
/** Same rows as the `seasons` seed in supabase/migrations/0004_player_tables.sql. */
export const SEASON_SEED: Season[] = [
  season(1, Date.UTC(2026, 9, 5), 28),
  season(2, Date.UTC(2026, 10, 2), 28),
  season(3, Date.UTC(2026, 10, 30), 28),
  season(4, Date.UTC(2026, 11, 28), 56),
  season(5, Date.UTC(2027, 1, 22), 56),
  season(6, Date.UTC(2027, 3, 19), 56),
  season(7, Date.UTC(2027, 5, 14), 56),
  season(8, Date.UTC(2027, 7, 9), 56),
]

const byStanding = (a: SeasonRating, b: SeasonRating) => b.rating - a.rating || a.updatedAt - b.updatedAt || a.playerId - b.playerId

export function createMemoryStore(): Store {
  const players = new Map<number, Player>()
  const badges = new Map<number, Set<string>>()
  const rewards = new Set<string>()
  const results: CaseResultRow[] = []
  const chats: ChatRow[] = []
  const rooms = new Map<string, RoomState>()
  const purchases = new Map<string, Purchase>()
  const ratings = new Map<string, SeasonRating>()
  const events: AppEvent[] = []
  const flags: Record<string, boolean> = {}
  const caseStats = new Map<string, CaseStats>()
  // Empty unless a test saves a row: the built-in cases stand in for the table.
  const caseRows = new Map<string, CaseRow>()
  const ranked = (season: number) => [...ratings.values()].filter((r) => r.season === season && r.rating > 0).sort(byStanding)

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

    async getBadges(playerId) {
      return [...(badges.get(playerId) ?? [])]
    },
    async addBadge(playerId, badge) {
      badges.set(playerId, (badges.get(playerId) ?? new Set()).add(badge))
    },
    async removeBadge(playerId, badge) {
      badges.get(playerId)?.delete(badge)
    },

    async hasSeasonReward(season, playerId) {
      return rewards.has(`${season}:${playerId}`)
    },
    async addSeasonReward(season, playerId) {
      const key = `${season}:${playerId}`
      if (rewards.has(key)) return false
      rewards.add(key)
      return true
    },

    async insertCaseResult(row) {
      if (results.some((r) => r.roomCode === row.roomCode && r.playerId === row.playerId)) return false
      results.push(clone(row))
      return true
    },
    async hasPlayed(playerId, caseId) {
      return results.some((r) => r.playerId === playerId && r.caseId === caseId)
    },
    async playedCaseIds(playerId) {
      return [...new Set(results.filter((r) => r.playerId === playerId).map((r) => r.caseId))]
    },
    async recentResults(playerId, limit) {
      return clone(results.filter((r) => r.playerId === playerId).sort((a, b) => b.at - a.at).slice(0, limit))
    },
    async seasonScores(playerId, s) {
      return results.filter((r) => r.playerId === playerId && r.rating !== undefined && r.at >= s.start && r.at < s.end).map((r) => r.rating!)
    },

    async getChats(code, playerId) {
      return clone(chats.filter((c) => c.roomCode === code && c.playerId === playerId).sort((a, b) => a.seq - b.seq))
    },
    async appendChat(row) {
      if (chats.some((c) => c.roomCode === row.roomCode && c.playerId === row.playerId && c.suspectId === row.suspectId && c.seq === row.seq))
        throw new Error('Chat message already exists')
      chats.push(clone(row))
    },
    async deleteLastChat(code, playerId, suspectId) {
      const thread = chats.filter((c) => c.roomCode === code && c.playerId === playerId && c.suspectId === suspectId)
      const last = thread.reduce<ChatRow | null>((a, c) => (!a || c.seq > a.seq ? c : a), null)
      if (last) chats.splice(chats.indexOf(last), 1)
    },

    async getSeasons() {
      return clone(SEASON_SEED)
    },

    async listCaseMeta() {
      return [...caseRows.values()].map((r) => ({ id: r.id, district: r.district, status: r.status, releaseAt: r.releaseAt, version: r.version }))
    },
    async getCaseRow(id) {
      const row = caseRows.get(id)
      return row ? clone(row) : null
    },
    async saveCase(row) {
      caseRows.set(row.id, clone(row))
    },

    async getCaseStats(caseId, mode) {
      const row = caseStats.get(`${caseId}:${mode}`)
      return row ? clone(row) : null
    },
    async bumpPlays(caseId, mode) {
      const key = `${caseId}:${mode}`
      const row = caseStats.get(key) ?? { caseId, mode, plays: 0, updatedAt: 0 }
      caseStats.set(key, { ...row, plays: row.plays + 1, updatedAt: Date.now() })
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

    async raiseSeasonRating(r) {
      const key = `${r.season}:${r.playerId}`
      const old = ratings.get(key)
      if (!old || r.rating > old.rating) ratings.set(key, clone(r))
      else if (r.rating === old.rating && r.cases > old.cases) ratings.set(key, { ...old, cases: r.cases, name: r.name, badge: r.badge })
    },
    async getSeasonLeaderboard(season, limit, offset = 0) {
      const all = ranked(season)
      return { rows: clone(all.slice(offset, offset + limit)), total: all.length }
    },
    async getSeasonPosition(season, playerId) {
      const i = ranked(season).findIndex((r) => r.playerId === playerId)
      return i < 0 ? null : i + 1
    },

    async trackEvents(batch) {
      events.push(...clone(batch))
    },
    async getFlags() {
      return { ...flags }
    },
  }
}
