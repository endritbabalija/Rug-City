import 'server-only'
import { canPlay, DISTRICTS, districtState, type DistrictState } from '../districts'
import type { Player } from '../player'
import { store } from '../store'
import type { CaseMeta } from '../store/types'
import { airdrop } from './airdrop'
import { audit } from './audit'
import { mooncat } from './mooncat'
import { caseSchema } from './schema'
import type { CaseFile } from './types'

// The case repository. Cases live in the `cases` table; the built-in cases below stand in
// for any id the table has no row for (and for everything on the memory store).

export const BUILT_IN_CASES: CaseFile[] = [mooncat, airdrop, audit]

/** How long a server trusts its copy of the table's index before reading it again. */
const INDEX_MS = 30_000

let index: { at: number; rows: Promise<Map<string, CaseMeta>> } | null = null
/** Validated case files by `id:version`, so each version is fetched and checked once per instance. */
const files = new Map<string, Promise<CaseFile | null>>()

function caseIndex() {
  const now = Date.now()
  if (!index || now - index.at >= INDEX_MS) {
    const rows: Promise<Map<string, CaseMeta>> = store()
      .listCaseMeta()
      .then((list) => new Map(list.map((m) => [m.id, m])))
      .catch((err) => {
        if (index?.rows === rows) index = null // try again on the next call
        throw err
      })
    index = { at: now, rows }
  }
  return index.rows
}

/** A stored case, validated. Null (and logged) if the row is gone or doesn't pass the schema. */
function loadFile(meta: CaseMeta) {
  const key = `${meta.id}:${meta.version}`
  let file = files.get(key)
  if (!file) {
    file = store()
      .getCaseRow(meta.id)
      .then((row) => {
        if (!row) return null
        const parsed = caseSchema.safeParse({ ...(row.data as object), id: row.id, district: row.district })
        if (parsed.success) return parsed.data
        console.error('Case failed validation', row.id, row.version, parsed.error.issues.slice(0, 5))
        return null
      })
    file.catch(() => files.delete(key)) // a failed read is retried; a failed check is not
    files.set(key, file)
  }
  return file
}

const released = (meta: CaseMeta, now: number) => meta.status === 'live' && (meta.releaseAt === null || meta.releaseAt <= now)

/** A case players can open now: live with `release_at` passed, or a built-in with no row. */
export async function getCase(id: string, now = Date.now()): Promise<CaseFile | undefined> {
  const meta = (await caseIndex()).get(id)
  if (!meta) return BUILT_IN_CASES.find((c) => c.id === id)
  return released(meta, now) ? ((await loadFile(meta)) ?? undefined) : undefined
}

/**
 * Any case a room may already be using, whatever its status now: a room that started
 * before its case was retired still plays to the end, and history keeps its titles.
 */
export async function caseForRoom(id: string): Promise<CaseFile | undefined> {
  const meta = (await caseIndex()).get(id)
  if (!meta) return BUILT_IN_CASES.find((c) => c.id === id)
  return (await loadFile(meta)) ?? undefined
}

/** Every case players can open now. */
export async function listCases(now = Date.now()): Promise<CaseFile[]> {
  const rows = await caseIndex()
  const stored = await Promise.all([...rows.values()].filter((m) => released(m, now)).map(loadFile))
  return [...BUILT_IN_CASES.filter((c) => !rows.has(c.id)), ...stored.filter((c): c is CaseFile => !!c)]
}

/** The earliest future `release_at` of a live case in these districts. */
async function nextRelease(districts: string[], now: number) {
  const times = [...(await caseIndex()).values()]
    .filter((m) => m.status === 'live' && m.releaseAt !== null && m.releaseAt > now && districts.includes(m.district))
    .map((m) => m.releaseAt!)
  return times.length ? Math.min(...times) : null
}

/** Tests only: forget the cached index and case files. */
export function resetCaseCache() {
  index = null
  files.clear()
}

const summary = (c: CaseFile, played: boolean) => ({
  id: c.id,
  title: c.title,
  crime: c.crime,
  tagline: c.tagline,
  ticker: c.project.ticker,
  suspects: c.suspects.length,
  district: c.district,
  preview: !!c.preview,
  played,
})

export type CaseSummary = ReturnType<typeof summary>

export interface DistrictSummary {
  id: string
  name: string
  crimes: string
  skill: string
  boss: string
  unlockRank: string
  order: number
  state: DistrictState
}

/**
 * What a player sees on Home: the districts that have cases, the cases they can open with
 * their played state, and the date (only) of the next case due in an open district.
 */
export async function caseBoard(player: Pick<Player, 'cluePoints'>, played: string[], now = Date.now()) {
  const cases = await listCases(now)
  const districts: DistrictSummary[] = DISTRICTS.filter((d) => cases.some((c) => c.district === d.id)).map((d) => ({
    id: d.id,
    name: d.name,
    crimes: d.crimes,
    skill: d.skill,
    boss: d.boss,
    unlockRank: d.unlockRank,
    order: d.order,
    state: districtState(player, d, cases),
  }))
  const open = districts.filter((d) => d.state === 'open').map((d) => d.id)
  const next = await nextRelease(open, now)
  return {
    districts,
    cases: cases.filter((c) => canPlay(player, c)).map((c) => summary(c, played.includes(c.id))),
    /** UTC date, `YYYY-MM-DD`. */
    nextDrop: next === null ? null : new Date(next).toISOString().slice(0, 10),
  }
}
