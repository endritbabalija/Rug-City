// Stars prices from the concept doc. Season pass is out of scope for the first version.

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

export const SKUS: Sku[] = [
  { id: 'pack5', title: 'Case pack', description: 'Host 5 more cases, any time.', stars: 250, kind: 'pack', grant: { caseCredits: 5 }, icon: '🗂️' },
  { id: 'subpoena', title: 'Subpoena', description: 'One suspect must answer your next question truthfully.', stars: 25, kind: 'powerup', grant: { items: { subpoena: 1 } }, icon: '⚖️' },
  { id: 'trace', title: 'Trace', description: "Reveal where a wallet's money came from, for the whole group.", stars: 15, kind: 'powerup', grant: { items: { trace: 1 } }, icon: '🧭' },
  { id: 'hint', title: 'Hint', description: 'Reveal the next hint to the whole group.', stars: 10, kind: 'powerup', grant: { items: { hint: 1 } }, icon: '💡' },
  { id: 'badge_rookie', title: 'Rookie Sleuth badge', description: 'Cosmetic. Shows next to your name.', stars: 50, kind: 'badge', grant: { badge: 'rookie' }, icon: '🔍' },
  { id: 'badge_hound', title: 'Chain Hound badge', description: 'Cosmetic. Shows next to your name.', stars: 100, kind: 'badge', grant: { badge: 'hound' }, icon: '🐕' },
  { id: 'badge_whisperer', title: 'Rug Whisperer badge', description: 'Cosmetic. Shows next to your name.', stars: 150, kind: 'badge', grant: { badge: 'whisperer' }, icon: '🧶' },
]

export const getSku = (id: string) => SKUS.find((s) => s.id === id)
