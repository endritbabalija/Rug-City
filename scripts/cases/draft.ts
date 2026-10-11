// Draft new cases with the model, check them, and store them for admin review.
//   npm run cases:draft -- --district memecoin-swamp --count 4 [--crime "…"] [--parallel 2]
// Passing cases go in as status 'review'; failing ones as 'draft', with the report in data.review.

import { districtById } from '../../lib/districts'
import { CASE_MODEL, checkCase, draftCase, solverFeedback, spent } from './ai'
import { parseArgs } from './args'
import { BUILT_INS } from './builtins'
import { db, freeId, takenIds } from './db'

/** Times a case is revised with the solver's feedback before it's saved as a draft. */
const REVISIONS = 2

/** Crime types per district. Picked in order, skipping ones already drafted. */
const CRIMES: Record<string, string[]> = {
  'memecoin-swamp': [
    'An influencer "call group" pumps a meme coin to its followers while insiders dump on them',
    'A token whose sells are quietly blocked for everyone except the team (a honeypot), until the team cashes out',
    'A launch where the team secretly buys most of the supply through many fresh wallets, then dumps it',
    'Liquidity tokens announced as "burned" were actually sent to a lookalike wallet the culprit controls',
    'A dev slowly sells the team allocation through wallets disguised as "marketing" spending',
    'A fake exchange-listing announcement pumps the price while insiders sell into it',
    'A community treasury drained by one multisig signer who talked the others into signing',
    'A charity meme coin whose donation wallet was quietly redirected',
    'A copycat token impersonating a trending coin, with a fake "official" contract',
    'A "holders raffle" where every prize went to insider wallets that then dumped',
    'A presale where the raised funds were moved out before launch and the launch never happened',
    'A hidden transfer tax that skims every trade into a wallet linked to the culprit',
    'A fake "hack" staged by a co-founder to cover a planned exit',
    'A market maker hired by the project who sold the tokens they were loaned',
  ],
}

type StoredData = { title?: string; project?: { name?: string }; review?: { crime?: string } }

async function main() {
  const { named } = parseArgs()
  const district = districtById(String(named.district ?? 'memecoin-swamp'))
  if (!district) throw new Error(`Unknown district ${String(named.district)}`)
  const count = Number(named.count ?? 1)
  const parallel = Number(named.parallel ?? 2)
  const store = db()

  const rows = await Promise.all((await store.listCaseMeta()).map((m) => store.getCaseRow(m.id)))
  const stored = rows.flatMap((r) => (r ? [r.data as StoredData] : []))
  const avoid = [...BUILT_INS.map((c) => `${c.title} (${c.project.name})`), ...stored.map((d) => `${d.title} (${d.project?.name})`)]
  const usedCrimes = new Set(stored.map((d) => d.review?.crime))
  const fixedCrime = typeof named.crime === 'string' ? named.crime : null
  const pool = (CRIMES[district.id] ?? []).filter((c) => !usedCrimes.has(c))
  const crimes = Array.from({ length: count }, (_, i) => fixedCrime ?? pool[i % Math.max(pool.length, 1)] ?? `A case about ${district.crimes.toLowerCase()}`)

  console.log(`Drafting ${count} ${district.name} case(s) with ${CASE_MODEL}, ${parallel} at a time.`)
  let passed = 0
  for (let i = 0; i < crimes.length; i += parallel) {
    await Promise.all(
      crimes.slice(i, i + parallel).map(async (crime, j) => {
        const tag = `[${i + j + 1}/${count}]`
        console.log(`${tag} ${crime}`)
        try {
          const draft = await draftCase({ district, crime, avoid }, BUILT_INS)
          if (!draft.ok) {
            console.log(`${tag} ✗ no valid draft after ${draft.attempts} attempts:\n  ${draft.errors.slice(0, 5).join('\n  ')}`)
            return
          }
          avoid.push(`${draft.caseFile.title} (${draft.caseFile.project.name})`)
          console.log(`${tag} drafted "${draft.caseFile.title}" in ${draft.attempts} attempt(s); running the solver… ($${spent().toFixed(2)} so far)`)
          let caseFile = draft.caseFile
          let review = await checkCase(caseFile, { draftModel: CASE_MODEL, crime })
          // Revise with the solver's feedback until it passes, up to REVISIONS times.
          for (let round = 1; !review.passed && round <= REVISIONS; round++) {
            console.log(`${tag} solver failed (${review.failures.length} problems); revision ${round}/${REVISIONS}… ($${spent().toFixed(2)} so far)`)
            const revised = await draftCase({ district, crime, avoid }, BUILT_INS, { previous: caseFile, feedback: solverFeedback(caseFile, review) })
            if (!revised.ok) break
            caseFile = revised.caseFile
            review = await checkCase(caseFile, { draftModel: CASE_MODEL, crime })
          }
          const id = freeId(caseFile.id, await takenIds(store))
          const status = review.passed ? 'review' : 'draft'
          await store.saveCase({ id, district: district.id, status, releaseAt: null, version: 1, data: { ...caseFile, id, review } })
          if (review.passed) passed++
          const detail = review.passed ? `needs interrogation: ${review.needsInterrogation.join(', ')}` : review.failures.slice(0, 6).join('\n  ')
          console.log(`${tag} ${review.passed ? '✓ in review' : '✗ saved as draft'}: ${id}\n  ${detail}\n  ($${spent().toFixed(2)} so far)`)
        } catch (err) {
          console.log(`${tag} ✗ failed: ${(err as Error).message}`)
        }
      }),
    )
  }
  console.log(`Done: ${passed}/${count} passed and are in review. Spent about $${spent().toFixed(2)}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
