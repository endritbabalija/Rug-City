'use client'

import { createContext, useContext } from 'react'
import type { CaseSummary, DistrictSummary } from '@/lib/cases'
import type { Sku } from '@/lib/catalog'
import type { PublicPlayer } from '@/lib/server'

export type Screen =
  | { name: 'home' }
  | { name: 'shop' }
  | { name: 'profile' }
  | { name: 'leaderboard' }
  | { name: 'district'; id: string }
  | { name: 'room'; code: string }

export interface GameCtx {
  player: PublicPlayer
  setPlayer: (p: PublicPlayer) => void
  /** Reloads the player and the case board, e.g. after a case closes. */
  refresh: () => Promise<void>
  /** Cases this player can open, with their played state. */
  cases: CaseSummary[]
  /** Districts that have cases, for the map (flag `districts`). */
  districts: DistrictSummary[]
  /** UTC date (`YYYY-MM-DD`) of the next case due in an open district. */
  nextDrop: string | null
  skus: Sku[]
  badges: Record<string, { name: string; icon: string }>
  /** Feature flags the client needs (lib/flags.ts). */
  flags: { season_banner: boolean; solo: boolean; dex_crew: boolean; districts: boolean }
  go: (s: Screen) => void
  toast: (text: string, tone?: 'info' | 'error' | 'ok') => void
  /** Buys an item with Stars and resolves true once it's in the inventory. */
  buy: (skuId: string) => Promise<boolean>
}

export const GameContext = createContext<GameCtx | null>(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame outside GameContext')
  return ctx
}
