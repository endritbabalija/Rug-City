import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Player } from '../player'
import { CONFLICT, withRetries, type Store } from './types'

// The `players` table still has columns from the earlier game (credits, items, points…).
// They all have defaults, so this store reads and writes only the columns below.
interface PlayerRow {
  id: number
  name: string | null
  username: string | null
  photo_url: string | null
  created_at: string
  version: number
}

const PLAYER_COLUMNS = 'id, name, username, photo_url, created_at, version'

const toPlayer = (r: PlayerRow): Player => ({
  id: Number(r.id),
  name: r.name ?? '',
  username: r.username ?? undefined,
  photoUrl: r.photo_url ?? undefined,
  createdAt: Date.parse(r.created_at),
})

/** The columns a player write sets (everything but the id, creation time and version). */
const playerColumns = (p: Player) => ({
  name: p.name,
  username: p.username ?? null,
  photo_url: p.photoUrl ?? null,
})

const iso = (ms: number) => new Date(ms).toISOString()

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`)
  return res.data
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } })

  const s: Store = {
    async getPlayer(id) {
      const row = check(await db.from('players').select(PLAYER_COLUMNS).eq('id', id).maybeSingle()) as PlayerRow | null
      return row ? toPlayer(row) : null
    },
    async createPlayer(p) {
      check(
        await db
          .from('players')
          .upsert({ id: p.id, ...playerColumns(p), created_at: iso(p.createdAt), version: 0 }, { onConflict: 'id', ignoreDuplicates: true }),
      )
      return (await s.getPlayer(p.id))!
    },
    /** Compare-and-swap on the row's `version`: read, apply `fn`, write only if nobody wrote in between. */
    updatePlayer(id, fn) {
      return withRetries<Player>(async () => {
        const row = check(await db.from('players').select(PLAYER_COLUMNS).eq('id', id).maybeSingle()) as PlayerRow | null
        if (!row) throw new Error(`players ${id} not found`)
        const next = fn(toPlayer(row))
        const updated = check(
          await db
            .from('players')
            .update({ ...playerColumns(next), version: row.version + 1, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('version', row.version)
            .select('version'),
        )
        return updated && updated.length > 0 ? next : CONFLICT
      })
    },

    async trackEvents(events) {
      if (!events.length) return
      check(
        await db
          .from('events')
          .insert(events.map((e) => ({ name: e.name, player_id: e.playerId, props: e.props, at: new Date(e.at).toISOString() }))),
      )
    },
    async getFlags() {
      const rows = check(await db.from('feature_flags').select('name, enabled')) as { name: string; enabled: boolean }[]
      return Object.fromEntries(rows.map((r) => [r.name, r.enabled]))
    },
  }
  return s
}
