// Types for the parts of backfill-v2.mjs that tests/backfill.test.ts imports.

export interface LegacyResultRow {
  room_code: string
  player_id: number
  case_id: string
  mode: 'legacy'
  seats: number
  correct: number
  score: number
  points: Record<string, never>
  total: number
  rating: number | null
  elapsed_sec: null
  unrated: string | null
  at: string
}

export function docHash(doc: unknown): string

export function rowsFromDoc(
  id: number,
  doc: Record<string, unknown>,
): {
  player: Record<string, string | number | boolean | null>
  badges: { player_id: number; badge: string }[]
  seasonRewards: { season: number; player_id: number }[]
  results: LegacyResultRow[]
}
