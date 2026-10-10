import 'server-only'
import type { CaseFile } from './types'
import { mooncat } from './mooncat'
import { audit } from './audit'
import { airdrop } from './airdrop'

export const CASES: CaseFile[] = [mooncat, audit, airdrop]

export function getCase(id: string): CaseFile | undefined {
  return CASES.find((c) => c.id === id)
}

export function caseSummaries() {
  return CASES.map((c) => ({
    id: c.id,
    title: c.title,
    crime: c.crime,
    tagline: c.tagline,
    ticker: c.project.ticker,
    suspects: c.suspects.length,
  }))
}

export type CaseSummary = ReturnType<typeof caseSummaries>[number]
