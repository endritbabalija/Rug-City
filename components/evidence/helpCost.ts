import { getSku, type ItemKey } from '@/lib/catalog'
import { HELP_PENALTY } from '@/lib/game/scoring'
import type { Help } from '@/lib/game/types'

const NAME: Record<keyof Help, string> = { hint: 'A Hint', trace: 'A Trace', subpoena: 'A Subpoena', dexHint: 'A Dex hint' }

export const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * What a help action costs, for its confirm box: the Stars price when the player has none of
 * the item, and the score penalty, which hits every seat in a crew.
 */
export function helpCost(kind: keyof Help, { owned, crew }: { owned?: number; crew: boolean }) {
  const stars = kind !== 'dexHint' && !owned ? getSku(kind as ItemKey)?.stars : undefined
  const price = stars ? `⭐${stars} (you have none) and ` : ''
  return `${NAME[kind]} costs ${price}${pct(HELP_PENALTY[kind])} of the case score${crew ? ' for everyone in the crew' : ''}. Use it anyway?`
}
