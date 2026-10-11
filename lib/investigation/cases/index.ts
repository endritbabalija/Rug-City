import 'server-only'
import { AppError } from '../../errors'
import type { CaseDefinition } from '../types'
import { THE_REFUND_V1 } from './refund'

/** Every authored version of every case. Old versions stay so existing runs keep reading theirs. */
const CASES: Record<string, Record<number, CaseDefinition>> = {
  'the-refund': { 1: THE_REFUND_V1 },
}

/** The version a new run starts on. */
export const CURRENT_VERSION: Record<string, number> = {
  'the-refund': 1,
}

export const CASE_IDS = Object.keys(CURRENT_VERSION)

export function getCase(caseId: string, version = CURRENT_VERSION[caseId]): CaseDefinition {
  const def = CASES[caseId]?.[version]
  if (!def) throw new AppError('NOT_FOUND', 'That case isn’t available.', 404)
  return def
}

/** Every authored definition, for content checks. */
export const allCases = (): CaseDefinition[] => Object.values(CASES).flatMap((versions) => Object.values(versions))
