// Stars prices from the concept doc. Season pass is out of scope for the first version.

import { HELP_PENALTY } from './game/scoring'

const cut = (kind: keyof typeof HELP_PENALTY) => `Cuts the case score by ${Math.round(HELP_PENALTY[kind] * 100)}% for everyone in the room.`

export type ItemKey = 'subpoena' | 'trace' | 'hint'

export interface Grant {
  caseCredits?: number
  items?: Partial<Record<ItemKey, number>>
  badge?: string
}

export interface Sku {
  id: string
  title: string
  description: string
  stars: number
  kind: 'pack' | 'powerup' | 'badge'
  grant: Grant
  icon: string
}

export const BADGES: Record<string, { name: string; icon: string }> = {
  rookie: { name: 'Rookie Sleuth', icon: '🔍' },
  hound: { name: 'Chain Hound', icon: '🐕' },
  whisperer: { name: 'Rug Whisperer', icon: '🧶' },
}

/** Season badges can't be bought: `s<season>-top10` for the top 10, `s<season>-elite` for the top 10%. */
export const seasonBadge = (season: number, tier: 'top10' | 'elite') => `s${season}-${tier}`

export function badgeInfo(id: string): { name: string; icon: string } | undefined {
  if (BADGES[id]) return BADGES[id]
  const m = /^s(\d+)-(top10|elite)$/.exec(id)
  if (!m) return undefined
  return m[2] === 'top10' ? { name: `Season ${m[1]} · Top 10`, icon: '🏆' } : { name: `Season ${m[1]} · Top 10%`, icon: '🎖️' }
}

export const SKUS: Sku[] = [
  { id: 'pack5', title: 'Case pack', description: 'Host or play solo 5 more cases, any time.', stars: 250, kind: 'pack', grant: { caseCredits: 5 }, icon: '🗂️' },
  { id: 'subpoena', title: 'Subpoena', description: `One suspect must answer your next question truthfully. ${cut('subpoena')}`, stars: 25, kind: 'powerup', grant: { items: { subpoena: 1 } }, icon: '⚖️' },
  { id: 'trace', title: 'Trace', description: `Reveal where a wallet's money came from, for the whole group. ${cut('trace')}`, stars: 15, kind: 'powerup', grant: { items: { trace: 1 } }, icon: '🧭' },
  { id: 'hint', title: 'Hint', description: `Reveal the next hint to the whole group. ${cut('hint')}`, stars: 10, kind: 'powerup', grant: { items: { hint: 1 } }, icon: '💡' },
  { id: 'badge_rookie', title: 'Rookie Sleuth badge', description: 'Cosmetic. Shows next to your name.', stars: 50, kind: 'badge', grant: { badge: 'rookie' }, icon: '🔍' },
  { id: 'badge_hound', title: 'Chain Hound badge', description: 'Cosmetic. Shows next to your name.', stars: 100, kind: 'badge', grant: { badge: 'hound' }, icon: '🐕' },
  { id: 'badge_whisperer', title: 'Rug Whisperer badge', description: 'Cosmetic. Shows next to your name.', stars: 150, kind: 'badge', grant: { badge: 'whisperer' }, icon: '🧶' },
]

export const getSku = (id: string) => SKUS.find((s) => s.id === id)
