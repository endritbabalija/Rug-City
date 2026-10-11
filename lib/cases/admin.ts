import 'server-only'
import { GameError } from '../game/engine'
import { store } from '../store'
import type { CaseRow, CaseStatus } from '../store/types'
import { staticProblems, type CaseReview } from './checks'
import { resetCaseCache } from './index'
import { caseSchema } from './schema'
import type { CaseFile } from './types'

// Admin review of stored cases (docs/archive/phase-1/06-case-pipeline.md). Routes check the
// caller is an admin before calling these.

type StoredCase = CaseFile & { review?: CaseReview }

const dataOf = (row: CaseRow) => row.data as StoredCase

async function requireRow(id: string) {
  const row = await store().getCaseRow(id)
  if (!row) throw new GameError('UNKNOWN_CASE', 'No stored case with that id.', 404)
  return row
}

/** Stored cases with one status, newest release first, with what the review list shows. */
export async function listStoredCases(status: CaseStatus) {
  const metas = (await store().listCaseMeta()).filter((m) => m.status === status)
  const rows = await Promise.all(metas.map((m) => store().getCaseRow(m.id)))
  return rows
    .filter((r): r is CaseRow => !!r)
    .map((r) => {
      const d = dataOf(r)
      return {
        id: r.id,
        district: r.district,
        status: r.status,
        releaseAt: r.releaseAt,
        version: r.version,
        title: d.title ?? r.id,
        crime: d.crime ?? '',
        targetSec: d.targetSec ?? null,
        passed: d.review?.passed ?? null,
        needsInterrogation: d.review?.needsInterrogation ?? [],
      }
    })
    .sort((a, b) => (b.releaseAt ?? 0) - (a.releaseAt ?? 0) || a.id.localeCompare(b.id))
}

export type StoredCaseSummary = Awaited<ReturnType<typeof listStoredCases>>[number]

/** Everything stored for one case, answers and solver report included. */
export async function storedCase(id: string) {
  const row = await requireRow(id)
  return { id: row.id, district: row.district, status: row.status, releaseAt: row.releaseAt, version: row.version, data: dataOf(row) }
}

export type StoredCaseDetail = Awaited<ReturnType<typeof storedCase>>

/** Makes a case in review live from `releaseAt`, with its final target time. */
export async function approveCase(id: string, opts: { releaseAt: number; targetSec: number }) {
  const row = await requireRow(id)
  if (row.status !== 'review') throw new GameError('NOT_IN_REVIEW', `This case is ${row.status}, not in review.`, 409)
  const data = { ...dataOf(row), targetSec: opts.targetSec }
  const parsed = caseSchema.safeParse({ ...data, id: row.id, district: row.district })
  if (!parsed.success) throw new GameError('INVALID_CASE', `The case doesn't pass the schema: ${parsed.error.issues[0]?.message}`, 422)
  const problems = staticProblems(parsed.data)
  if (problems.length) throw new GameError('INVALID_CASE', `The case fails a static check: ${problems[0]}`, 422)
  await store().saveCase({ ...row, status: 'live', releaseAt: opts.releaseAt, version: row.version + 1, data })
  resetCaseCache()
  return storedCase(id)
}

/** Takes a case out of review (or off the board) and records why. */
export async function rejectCase(id: string, reason?: string) {
  const row = await requireRow(id)
  if (row.status === 'retired') throw new GameError('ALREADY_RETIRED', 'This case is already retired.', 409)
  const d = dataOf(row)
  const review = d.review ? { ...d.review, rejected: { at: Date.now(), reason } } : undefined
  await store().saveCase({ ...row, status: 'retired', version: row.version + 1, data: { ...d, ...(review && { review }) } })
  resetCaseCache()
  return storedCase(id)
}
