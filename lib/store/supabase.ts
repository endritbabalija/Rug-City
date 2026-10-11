import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Run, RunProgress } from '../investigation/types'
import type { Player } from '../player'
import { CONFLICT, withRetries, type Store } from './types'

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

interface RunRow {
  id: string
  player_id: number
  case_id: string
  case_version: number
  status: Run['status']
  doc: RunProgress
  version: number
  created_at: string
  updated_at: string
  resolved_at: string | null
}

const RUN_COLUMNS = 'id, player_id, case_id, case_version, status, doc, version, created_at, updated_at, resolved_at'

const toRun = (r: RunRow): Run => ({
  id: r.id,
  ownerId: Number(r.player_id),
  caseId: r.case_id,
  caseVersion: r.case_version,
  status: r.status,
  progress: r.doc,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
  resolvedAt: r.resolved_at ? Date.parse(r.resolved_at) : null,
})

/** The columns a run write sets. The owner, case and version a run started on never change. */
const runColumns = (r: Run) => ({
  status: r.status,
  doc: r.progress,
  updated_at: iso(r.updatedAt),
  resolved_at: r.resolvedAt === null ? null : iso(r.resolvedAt),
})

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

    async createRun(run) {
      check(
        await db.from('investigation_runs').upsert(
          {
            id: run.id,
            player_id: run.ownerId,
            case_id: run.caseId,
            case_version: run.caseVersion,
            ...runColumns(run),
            created_at: iso(run.createdAt),
            version: 0,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        ),
      )
      return (await s.getRun(run.id))!
    },
    async getRun(id) {
      const row = check(await db.from('investigation_runs').select(RUN_COLUMNS).eq('id', id).maybeSingle()) as RunRow | null
      return row ? toRun(row) : null
    },
    async getLatestRun(playerId, caseId) {
      const row = check(
        await db
          .from('investigation_runs')
          .select(RUN_COLUMNS)
          .eq('player_id', playerId)
          .eq('case_id', caseId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as RunRow | null
      return row ? toRun(row) : null
    },
    /** Compare-and-swap on the row's `version`, like `updatePlayer`. */
    updateRun(id, fn) {
      return withRetries<Run>(async () => {
        const row = check(await db.from('investigation_runs').select(RUN_COLUMNS).eq('id', id).maybeSingle()) as RunRow | null
        if (!row) throw new Error(`investigation_runs ${id} not found`)
        const current = toRun(row)
        const next = fn(current)
        if (!next) return current
        const updated = check(
          await db
            .from('investigation_runs')
            .update({ ...runColumns(next), version: row.version + 1 })
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
