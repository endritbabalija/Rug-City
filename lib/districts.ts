import type { CaseFile } from './cases/types'
import { RANKS, rankFor } from './game/progress'
import type { Player } from './player'

// The six districts of Rug City (Game Design v2 → Districts). Each opens at a Clue Points rank;
// a locked district can still hold preview cases that anyone can play as a teaser.

type RankTitle = (typeof RANKS)[number]['title']

export interface District {
  id: string
  name: string
  crimes: string
  /** The detective skill its cases test. */
  skill: string
  /** Working name of the district's boss. */
  boss: string
  /** Rank that opens the district (provisional, docs/phase-1/DEFAULTS.md → District unlocks). */
  unlockRank: RankTitle
  order: number
}

export const DISTRICTS = [
  { id: 'memecoin-swamp', name: 'Memecoin Swamp', crimes: 'Rugs, pump-and-dumps', skill: 'Follow the money from wallet to wallet', boss: 'The Frog King', unlockRank: 'Rookie', order: 1 },
  { id: 'sybil-square', name: 'Sybil Square', crimes: 'Bot farms, wallet drainers, voting takeovers', skill: 'Link many fake wallets to one person', boss: 'The Puppeteer', unlockRank: 'Inspector', order: 2 },
  { id: 'defi-docks', name: 'DeFi Docks', crimes: 'Exploits, flash-loan attacks, hidden backdoors', skill: 'Read simplified code and find the backdoor', boss: 'The Engineer', unlockRank: 'Chief', order: 3 },
  { id: 'nft-gallery', name: 'NFT Gallery', crimes: 'Wash trading, stolen and copied art', skill: 'Trace ownership: who sold to whom, which item is a copy', boss: 'The Curator', unlockRank: 'Legend', order: 4 },
  { id: 'exchange-tower', name: 'Exchange Tower', crimes: 'Insider listings, missing customer funds', skill: "Spot what doesn't add up between the books and the chain", boss: 'The Chairman', unlockRank: 'Legend', order: 5 },
  { id: 'the-laundromat', name: 'The Laundromat', crimes: 'Money hidden across chains and mixers', skill: 'Trace funds across chains and mixers', boss: 'The Launderer', unlockRank: 'Legend', order: 6 },
] as const satisfies readonly District[]

export type DistrictId = (typeof DISTRICTS)[number]['id']

export const DISTRICT_IDS = DISTRICTS.map((d) => d.id) as [DistrictId, ...DistrictId[]]

export function districtById(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id)
}

/** `open`: the player's rank reached it. `teaser`: locked, but it has a preview case to play. `locked`: neither. */
export type DistrictState = 'open' | 'locked' | 'teaser'

type Ranked = Pick<Player, 'cluePoints'>
type CaseKey = Pick<CaseFile, 'district' | 'preview'>

function isOpen(player: Ranked, district: District) {
  return rankFor(player.cluePoints ?? 0).level >= RANKS.findIndex((r) => r.title === district.unlockRank)
}

/** A district's state for a player, given the live cases (so a locked one with a preview case is a teaser). */
export function districtState(player: Ranked, district: District, cases: readonly CaseKey[] = []): DistrictState {
  if (isOpen(player, district)) return 'open'
  return cases.some((c) => c.district === district.id && c.preview) ? 'teaser' : 'locked'
}

/** Preview cases are playable anywhere; any other case only once its district is open. */
export function canPlay(player: Ranked, c: CaseKey) {
  if (c.preview) return true
  const district = districtById(c.district)
  return !!district && isOpen(player, district)
}

/** Clue Points towards a district's unlock rank, for the map's progress bar. `have` stops at `need`. */
export function unlockProgress(player: Ranked, district: Pick<District, 'unlockRank'>) {
  const need = RANKS.find((r) => r.title === district.unlockRank)?.at ?? 0
  return { have: Math.min(Math.max(0, player.cluePoints ?? 0), need), need }
}

type BoardCase = { id: string; district: string; played: boolean }

/**
 * Home's Next case card. With `tutorialId` (a player with no finished case) it's the tutorial
 * case, marked "Start here"; otherwise the newest unplayed case in an open district, or null
 * when they're all played. `cases` must be newest first.
 */
export function pickNextCase(cases: readonly BoardCase[], open: readonly string[], tutorialId?: string): { id: string; startHere: boolean } | null {
  const tutorial = tutorialId ? cases.find((c) => c.id === tutorialId && open.includes(c.district)) : undefined
  if (tutorial) return { id: tutorial.id, startHere: true }
  const next = cases.find((c) => !c.played && open.includes(c.district))
  return next ? { id: next.id, startHere: false } : null
}
