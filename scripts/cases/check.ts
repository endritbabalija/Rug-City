// Run the static checks and the blind solver on one case, stored or built in.
//   npm run cases:check -- <id> [--save]
// --save writes the report to a stored case's data.review, and moves a passing draft into review.

import type { SolverRun } from '../../lib/cases/checks'
import type { CaseFile } from '../../lib/cases/types'
import { checkCase, spent } from './ai'
import { parseArgs } from './args'
import { BUILT_INS } from './builtins'
import { db } from './db'

const line = (r: SolverRun) => `  ${r.pass ? '✓' : '✗'} ${r.label}: ${r.culprit} / ${r.motive} / ${r.trail} (${r.confidence})`

async function main() {
  const { named, positional } = parseArgs()
  const id = positional[0]
  if (!id) throw new Error('Usage: npm run cases:check -- <id> [--save]')
  const store = db()
  const row = await store.getCaseRow(id)
  const data = row?.data as (CaseFile & { review?: { crime?: string } }) | undefined
  const caseFile: CaseFile | undefined = row && data ? { ...data, id: row.id, district: row.district as CaseFile['district'] } : BUILT_INS.find((c) => c.id === id)
  if (!caseFile) throw new Error(`No stored or built-in case "${id}"`)

  console.log(`Checking ${id} (${row ? `stored, ${row.status}` : 'built in'})…`)
  const review = await checkCase(caseFile, { crime: data?.review?.crime })
  console.log('Public info only (must not guess it):')
  review.publicOnly?.forEach((r) => console.log(line(r)))
  console.log('All clues + interrogation (must get 3/3):')
  review.full.forEach((r) => console.log(line(r)))
  console.log('All clues, no chats (must miss one):')
  review.noChats.forEach((r) => console.log(line(r)))
  console.log('Single hands (must not name the culprit with high confidence):')
  review.hands.forEach((r) => console.log(line(r)))
  console.log(`Needs interrogation: ${review.needsInterrogation.join(', ') || 'nothing'}`)
  console.log(review.passed ? 'PASSED' : `FAILED:\n  ${review.failures.join('\n  ')}`)

  if (named.save) {
    if (!row) throw new Error('--save only works for stored cases')
    const status = row.status === 'draft' && review.passed ? 'review' : row.status
    await store.saveCase({ ...row, status, version: row.version + 1, data: { ...data, review } })
    console.log(`Saved the report${status !== row.status ? ` and moved it to ${status}` : ''}.`)
  }
  console.log(`Spent about $${spent().toFixed(2)}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
