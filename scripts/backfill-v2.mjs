// One-off backfill for migration 0004: copies every players.doc into the typed player
// columns, player_badges, season_rewards and case_results.
// Usage: node --env-file=.env.local scripts/backfill-v2.mjs [--dry-run]
//
// Take a backup first (Supabase → Database → Backups, or export the players table).
//
// Safe to run more than once. Each player row remembers the md5 of the doc it was copied
// from (backfilled_doc): an unchanged doc is skipped, so columns written by the new code
// are never overwritten. A doc that changed since (the code on main still writes it while a
// branch is tested on the shared database) is copied again. Side-table rows are only added.
//
// case_results rows are rebuilt from `recent`, `playedCases` and the season scores. They use
// room codes `legacy-…` (real codes are 5 characters, A-Z 0-9) and mode 'legacy', so they can't
// collide with real rooms and stay out of solve-time medians.

import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const iso = (ms) => new Date(ms).toISOString()

/** Old fixed-length calendar (lib/game/progress.ts before 0004): 8-week seasons from 5 Oct 2026. */
const OLD_SEASON_START = (id) => Date.UTC(2026, 9, 5) + (id - 1) * 8 * 7 * 86_400_000

export const docHash = (doc) => createHash('md5').update(JSON.stringify(doc)).digest('hex')

/** Everything one old player doc becomes. Pure, so tests/backfill.test.ts can check it. */
export function rowsFromDoc(id, doc) {
  const player = {
    name: doc.name ?? '',
    username: doc.username ?? null,
    photo_url: doc.photoUrl ?? null,
    case_credits: doc.caseCredits ?? 0,
    subpoena: doc.items?.subpoena ?? 0,
    trace: doc.items?.trace ?? 0,
    hint: doc.items?.hint ?? 0,
    free_case_day: doc.freeCaseDay ?? null,
    referred_by: doc.referredBy ?? null,
    referral_settled: !!doc.referralSettled,
    active_badge: doc.activeBadge ?? null,
    clue_points: doc.cluePoints ?? 0,
    streak_days: doc.streakDays ?? 0,
    last_rated_day: doc.lastRatedDay ?? null,
    rated_day: doc.ratedDay ?? null,
    rated_count: doc.ratedCount ?? 0,
  }
  const badges = [...new Set(doc.badges ?? [])].map((badge) => ({ player_id: id, badge }))
  const seasonRewards = [...new Set(doc.seasonRewards ?? [])].map((season) => ({ season, player_id: id }))

  const results = []
  const base = { player_id: id, mode: 'legacy', seats: 0, points: {}, elapsed_sec: null }
  const add = (row) => {
    if (!results.some((r) => r.room_code === row.room_code)) results.push({ ...base, ...row })
  }

  // Oldest first, so a case's first finish (the one that could be rated) wins over replays.
  const recent = [...(doc.recent ?? [])].sort((a, b) => a.at - b.at)
  for (const r of recent) {
    add({
      room_code: `legacy-${r.caseId}`,
      case_id: r.caseId,
      correct: r.correct ?? 0,
      score: r.rating ?? 0,
      total: r.points ?? 0,
      rating: r.rating ?? null,
      unrated: r.unrated ?? null,
      at: iso(r.at),
    })
  }

  // Finished cases that fell off `recent` (it kept 10): needed so replays stay unrated.
  for (const caseId of doc.playedCases ?? []) {
    add({ room_code: `legacy-${caseId}`, case_id: caseId, correct: 0, score: 0, total: 0, rating: null, unrated: 'legacy', at: iso(doc.createdAt ?? 0) })
  }

  // Season scores not covered by a rated row above get a row of their own, so the season
  // rating stays the same. Case id 'legacy' never matches a real case or shows in recent cases.
  if (doc.season?.scores?.length) {
    const left = [...doc.season.scores]
    for (const r of results) {
      const i = r.rating === null ? -1 : left.indexOf(r.rating)
      if (i >= 0) left.splice(i, 1)
    }
    left.forEach((score, i) =>
      add({
        room_code: `legacy-s${doc.season.id}-${i}`,
        case_id: 'legacy',
        correct: 0,
        score,
        total: 0,
        rating: score,
        unrated: null,
        at: iso(OLD_SEASON_START(doc.season.id)),
      }),
    )
  }

  return { player, badges, seasonRewards, results }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  const dryRun = process.argv.includes('--dry-run')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const check = (res) => {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`)
    return res.data
  }
  /** Inserts rows that aren't there yet; returns how many were new (in a dry run, how many it would try). */
  const insertNew = async (table, onConflict, rows) => {
    if (dryRun) return rows.length
    if (!rows.length) return 0
    return check(await db.from(table).upsert(rows, { onConflict, ignoreDuplicates: true }).select()).length
  }

  const sum = { players: 0, copied: 0, unchanged: 0, noDoc: 0, conflicts: 0, badges: 0, seasonRewards: 0, results: 0 }
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const rows = check(await db.from('players').select('id, doc, version, backfilled_doc').order('id').range(from, from + PAGE - 1))
    for (const row of rows) {
      sum.players++
      if (!row.doc) {
        sum.noDoc++
        continue
      }
      const hash = docHash(row.doc)
      if (row.backfilled_doc === hash) {
        sum.unchanged++
        continue
      }
      const out = rowsFromDoc(Number(row.id), row.doc)
      // Side tables first: the player update below is what marks this doc as done.
      sum.badges += await insertNew('player_badges', 'player_id,badge', out.badges)
      sum.seasonRewards += await insertNew('season_rewards', 'season,player_id', out.seasonRewards)
      sum.results += await insertNew('case_results', 'room_code,player_id', out.results)
      if (dryRun) {
        sum.copied++
        continue
      }
      // Bump the version so a concurrent compare-and-swap rereads instead of overwriting this.
      const updated = check(
        await db
          .from('players')
          .update({ ...out.player, backfilled_doc: hash, version: row.version + 1, updated_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('version', row.version)
          .select('id'),
      )
      if (updated.length) sum.copied++
      else sum.conflicts++
    }
    if (rows.length < PAGE) break
  }

  console.log(dryRun ? 'Dry run, nothing written.' : 'Backfill done.')
  console.log(`Players: ${sum.players} (${sum.copied} copied, ${sum.unchanged} unchanged since the last run, ${sum.noDoc} without a doc)`)
  console.log(`New rows: ${sum.badges} badges, ${sum.seasonRewards} season rewards, ${sum.results} case results`)
  if (sum.conflicts) console.log(`${sum.conflicts} players changed while copying: run the script again.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
