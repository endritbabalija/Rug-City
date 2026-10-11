import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Season } from '../game/progress'
import type { CaseResultRow, RoomState } from '../game/types'
import type { Player } from '../player'
import { CONFLICT, withRetries, type ChatRow, type Purchase, type PurchaseStatus, type SeasonRating, type Store } from './types'

interface PlayerRow {
  id: number
  name: string | null
  username: string | null
  photo_url: string | null
  case_credits: number
  subpoena: number
  trace: number
  hint: number
  free_case_day: string | null
  referred_by: number | null
  referral_settled: boolean
  active_badge: string | null
  clue_points: number
  streak_days: number
  last_rated_day: string | null
  rated_day: string | null
  rated_count: number
  created_at: string
  version: number
}

const PLAYER_COLUMNS =
  'id, name, username, photo_url, case_credits, subpoena, trace, hint, free_case_day, referred_by, referral_settled, active_badge, clue_points, streak_days, last_rated_day, rated_day, rated_count, created_at, version'

const toPlayer = (r: PlayerRow): Player => ({
  id: Number(r.id),
  name: r.name ?? '',
  username: r.username ?? undefined,
  photoUrl: r.photo_url ?? undefined,
  caseCredits: r.case_credits,
  freeCaseDay: r.free_case_day ?? undefined,
  items: { subpoena: r.subpoena, trace: r.trace, hint: r.hint },
  activeBadge: r.active_badge ?? undefined,
  referredBy: r.referred_by === null ? undefined : Number(r.referred_by),
  referralSettled: r.referral_settled,
  createdAt: Date.parse(r.created_at),
  cluePoints: r.clue_points,
  streakDays: r.streak_days,
  lastRatedDay: r.last_rated_day ?? undefined,
  ratedDay: r.rated_day ?? undefined,
  ratedCount: r.rated_count,
})

/** The columns a player write sets (everything but the id, creation time and version). */
const playerColumns = (p: Player) => ({
  name: p.name,
  username: p.username ?? null,
  photo_url: p.photoUrl ?? null,
  case_credits: p.caseCredits,
  subpoena: p.items.subpoena ?? 0,
  trace: p.items.trace ?? 0,
  hint: p.items.hint ?? 0,
  free_case_day: p.freeCaseDay ?? null,
  referred_by: p.referredBy ?? null,
  referral_settled: !!p.referralSettled,
  active_badge: p.activeBadge ?? null,
  clue_points: p.cluePoints ?? 0,
  streak_days: p.streakDays ?? 0,
  last_rated_day: p.lastRatedDay ?? null,
  rated_day: p.ratedDay ?? null,
  rated_count: p.ratedCount ?? 0,
})

interface CaseResultDbRow {
  room_code: string
  player_id: number
  case_id: string
  mode: CaseResultRow['mode']
  seats: number
  correct: number
  score: number
  points: CaseResultRow['points']
  total: number
  rating: number | null
  elapsed_sec: number | null
  unrated: string | null
  at: string
}

const toResult = (r: CaseResultDbRow): CaseResultRow => ({
  roomCode: r.room_code,
  playerId: Number(r.player_id),
  caseId: r.case_id,
  mode: r.mode,
  seats: r.seats,
  correct: r.correct,
  score: r.score,
  points: r.points,
  total: r.total,
  rating: r.rating ?? undefined,
  elapsedSec: r.elapsed_sec ?? undefined,
  unrated: r.unrated ?? undefined,
  at: Date.parse(r.at),
})

interface ChatDbRow {
  room_code: string
  player_id: number
  suspect_id: string
  seq: number
  sender: ChatRow['from']
  text: string
  subpoena: boolean
  at: string
}

const toChat = (r: ChatDbRow): ChatRow => ({
  roomCode: r.room_code,
  playerId: Number(r.player_id),
  suspectId: r.suspect_id,
  seq: r.seq,
  from: r.sender,
  text: r.text,
  subpoena: r.subpoena || undefined,
  at: Date.parse(r.at),
})

const iso = (ms: number) => new Date(ms).toISOString()
/** Postgres unique violation: the row was already there. */
const DUPLICATE = '23505'

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

  /** Compare-and-swap on a row's `version`: read, apply `fn`, write only if nobody wrote in between. */
  async function cas<T, R extends { version: number }>(
    table: 'players' | 'rooms',
    keyCol: 'id' | 'code',
    key: string | number,
    columns: string,
    map: { read: (row: R) => T; write: (v: T) => Record<string, unknown> },
    fn: (v: T) => T,
    after?: (v: number) => void,
  ) {
    return withRetries<T>(async () => {
      const row = check(await db.from(table).select(columns).eq(keyCol, key).maybeSingle()) as R | null
      if (!row) throw new Error(`${table} ${key} not found`)
      const next = fn(map.read(row))
      const updated = check(
        await db
          .from(table)
          .update({ ...map.write(next), version: row.version + 1, updated_at: new Date().toISOString() })
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
    updatePlayer(id, fn) {
      return cas<Player, PlayerRow>('players', 'id', id, PLAYER_COLUMNS, { read: toPlayer, write: playerColumns }, fn)
    },

    async getBadges(playerId) {
      const rows = check(await db.from('player_badges').select('badge').eq('player_id', playerId).order('at')) as { badge: string }[]
      return rows.map((r) => r.badge)
    },
    async addBadge(playerId, badge) {
      check(await db.from('player_badges').upsert({ player_id: playerId, badge }, { onConflict: 'player_id,badge', ignoreDuplicates: true }))
    },
    async removeBadge(playerId, badge) {
      check(await db.from('player_badges').delete().match({ player_id: playerId, badge }))
    },

    async hasSeasonReward(season, playerId) {
      const res = await db.from('season_rewards').select('season', { count: 'exact', head: true }).match({ season, player_id: playerId })
      check(res)
      return (res.count ?? 0) > 0
    },
    async addSeasonReward(season, playerId) {
      const res = await db.from('season_rewards').insert({ season, player_id: playerId })
      if (res.error?.code === DUPLICATE) return false
      check(res)
      return true
    },

    async insertCaseResult(r) {
      const res = await db.from('case_results').insert({
        room_code: r.roomCode,
        player_id: r.playerId,
        case_id: r.caseId,
        mode: r.mode,
        seats: r.seats,
        correct: r.correct,
        score: r.score,
        points: r.points,
        total: r.total,
        rating: r.rating ?? null,
        elapsed_sec: r.elapsedSec ?? null,
        unrated: r.unrated ?? null,
        at: iso(r.at),
      })
      if (res.error?.code === DUPLICATE) return false
      check(res)
      return true
    },
    async hasPlayed(playerId, caseId) {
      const res = await db.from('case_results').select('id', { count: 'exact', head: true }).match({ player_id: playerId, case_id: caseId })
      check(res)
      return (res.count ?? 0) > 0
    },
    async recentResults(playerId, limit) {
      const rows = check(await db.from('case_results').select('*').eq('player_id', playerId).order('at', { ascending: false }).limit(limit))
      return (rows as CaseResultDbRow[]).map(toResult)
    },
    async seasonScores(playerId, season: Season) {
      const rows = check(
        await db
          .from('case_results')
          .select('rating')
          .eq('player_id', playerId)
          .not('rating', 'is', null)
          .gte('at', iso(season.start))
          .lt('at', iso(season.end)),
      ) as { rating: number }[]
      return rows.map((r) => r.rating)
    },

    async getChats(code, playerId) {
      const rows = check(await db.from('room_chats').select('*').match({ room_code: code, player_id: playerId }).order('seq'))
      return (rows as ChatDbRow[]).map(toChat)
    },
    async appendChat(c) {
      check(
        await db.from('room_chats').insert({
          room_code: c.roomCode,
          player_id: c.playerId,
          suspect_id: c.suspectId,
          seq: c.seq,
          sender: c.from,
          text: c.text,
          subpoena: !!c.subpoena,
          at: iso(c.at),
        }),
      )
    },
    async deleteLastChat(code, playerId, suspectId) {
      const key = { room_code: code, player_id: playerId, suspect_id: suspectId }
      const last = check(await db.from('room_chats').select('seq').match(key).order('seq', { ascending: false }).limit(1)) as { seq: number }[]
      if (last.length) check(await db.from('room_chats').delete().match({ ...key, seq: last[0].seq }))
    },

    async getSeasons() {
      const rows = check(await db.from('seasons').select('id, starts_at, ends_at')) as { id: number; starts_at: string; ends_at: string }[]
      return rows.map((r) => ({ id: r.id, start: Date.parse(r.starts_at), end: Date.parse(r.ends_at) }))
    },

    async createRoom(state) {
      const res = await db.from('rooms').insert({ code: state.code, doc: state, version: 0 })
      if (res.error?.code === DUPLICATE) return false
      check(res)
      return true
    },
    async getRoom(code) {
      const row = check(await db.from('rooms').select('doc').eq('code', code).maybeSingle())
      return row ? (row.doc as RoomState) : null
    },
    updateRoom(code, fn) {
      const doc = { read: (r: { doc: RoomState }) => r.doc, write: (d: RoomState) => ({ doc: d }) }
      return cas<RoomState, { doc: RoomState; version: number }>('rooms', 'code', code, 'doc, version', doc, fn, (v) => void signalRoom(url, serviceKey, code, v))
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
