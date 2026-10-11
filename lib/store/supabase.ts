import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RoomState } from '../game/types'
import type { Player } from '../player'
import { CONFLICT, withRetries, type Purchase, type PurchaseStatus, type SeasonRating, type Store } from './types'

interface PurchaseRow {
  id: string
  user_id: number
  sku: string
  stars: number
  status: PurchaseStatus
  charge_id: string | null
  created_at: string
}

const toPurchase = (r: PurchaseRow): Purchase => ({
  id: r.id,
  userId: Number(r.user_id),
  sku: r.sku,
  stars: r.stars,
  status: r.status,
  chargeId: r.charge_id ?? undefined,
  createdAt: Date.parse(r.created_at),
})

interface SeasonRatingRow {
  season: number
  player_id: number
  name: string
  badge: string | null
  rating: number
  cases: number
  updated_at: string
}

const toRating = (r: SeasonRatingRow): SeasonRating => ({
  season: r.season,
  playerId: Number(r.player_id),
  name: r.name,
  badge: r.badge ?? undefined,
  rating: r.rating,
  cases: r.cases,
  updatedAt: Date.parse(r.updated_at),
})

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`)
  return res.data
}

/**
 * Tell subscribed clients that a room changed. Payload is only the version: clients
 * refetch their own projection through the API, so nothing private goes over the socket.
 */
async function signalRoom(url: string, serviceKey: string, code: string, version: number) {
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: `room:${code}`, event: 'update', payload: { version }, private: false }] }),
    })
  } catch {
    // Clients also poll, so a missed signal only costs a few seconds.
  }
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } })

  async function casDoc<T>(table: 'players' | 'rooms', keyCol: 'id' | 'code', key: string | number, fn: (d: T) => T, after?: (v: number) => void) {
    return withRetries<T>(async () => {
      const row = check(await db.from(table).select('doc, version').eq(keyCol, key).maybeSingle())
      if (!row) throw new Error(`${table} ${key} not found`)
      const next = fn(row.doc as T)
      const updated = check(
        await db
          .from(table)
          .update({ doc: next, version: row.version + 1, updated_at: new Date().toISOString() })
          .eq(keyCol, key)
          .eq('version', row.version)
          .select('version'),
      )
      if (!updated || updated.length === 0) return CONFLICT
      after?.(row.version + 1)
      return next
    })
  }

  const s: Store = {
    async getPlayer(id) {
      const row = check(await db.from('players').select('doc').eq('id', id).maybeSingle())
      return row ? (row.doc as Player) : null
    },
    async createPlayer(p) {
      check(await db.from('players').upsert({ id: p.id, doc: p, version: 0 }, { onConflict: 'id', ignoreDuplicates: true }))
      return (await s.getPlayer(p.id))!
    },
    updatePlayer(id, fn) {
      return casDoc<Player>('players', 'id', id, fn)
    },

    async createRoom(state) {
      const res = await db.from('rooms').insert({ code: state.code, doc: state, version: 0 })
      if (res.error?.code === '23505') return false
      check(res)
      return true
    },
    async getRoom(code) {
      const row = check(await db.from('rooms').select('doc').eq('code', code).maybeSingle())
      return row ? (row.doc as RoomState) : null
    },
    updateRoom(code, fn) {
      return casDoc<RoomState>('rooms', 'code', code, fn, (v) => void signalRoom(url, serviceKey, code, v))
    },

    async createPurchase(p) {
      check(await db.from('purchases').insert({ id: p.id, user_id: p.userId, sku: p.sku, stars: p.stars, status: p.status }))
    },
    async getPurchase(id) {
      const row = check(await db.from('purchases').select('*').eq('id', id).maybeSingle())
      return row ? toPurchase(row as PurchaseRow) : null
    },
    async getPurchaseByCharge(chargeId) {
      const row = check(await db.from('purchases').select('*').eq('charge_id', chargeId).maybeSingle())
      return row ? toPurchase(row as PurchaseRow) : null
    },
    async transitionPurchase(id, from, to, chargeId) {
      const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() }
      if (chargeId) patch.charge_id = chargeId
      const rows = check(await db.from('purchases').update(patch).eq('id', id).eq('status', from).select('*'))
      return rows && rows.length ? toPurchase(rows[0] as PurchaseRow) : null
    },

    async raiseSeasonRating(r) {
      const key = { season: r.season, player_id: r.playerId }
      const row = { ...key, name: r.name, badge: r.badge ?? null, rating: r.rating, cases: r.cases, updated_at: new Date(r.updatedAt).toISOString() }
      // Insert if missing, then raise only if higher: any order of concurrent writes ends at the max.
      check(await db.from('season_ratings').upsert(row, { onConflict: 'season,player_id', ignoreDuplicates: true }))
      check(await db.from('season_ratings').update(row).match(key).lt('rating', r.rating))
      // Same rating with more cases (a 0-point case): update the count but keep the tie-break time.
      check(await db.from('season_ratings').update({ cases: r.cases, name: r.name, badge: r.badge ?? null }).match(key).eq('rating', r.rating).lt('cases', r.cases))
    },
    async getSeasonLeaderboard(season, limit, offset = 0) {
      if (limit <= 0) {
        const res = await db.from('season_ratings').select('player_id', { count: 'exact', head: true }).eq('season', season).gt('rating', 0)
        check(res)
        return { rows: [], total: res.count ?? 0 }
      }
      const res = await db
        .from('season_ratings')
        .select('*', { count: 'exact' })
        .eq('season', season)
        .gt('rating', 0)
        .order('rating', { ascending: false })
        .order('updated_at', { ascending: true })
        .order('player_id', { ascending: true })
        .range(offset, offset + limit - 1)
      const rows = check(res) as SeasonRatingRow[]
      return { rows: rows.map(toRating), total: res.count ?? rows.length }
    },
    async getSeasonPosition(season, playerId) {
      const mine = check(await db.from('season_ratings').select('*').eq('season', season).eq('player_id', playerId).maybeSingle()) as SeasonRatingRow | null
      if (!mine || mine.rating <= 0) return null
      const ahead = await db
        .from('season_ratings')
        .select('player_id', { count: 'exact', head: true })
        .eq('season', season)
        .or(`rating.gt.${mine.rating},and(rating.eq.${mine.rating},updated_at.lt."${mine.updated_at}")`)
      check(ahead)
      return (ahead.count ?? 0) + 1
    },
  }
  return s
}
