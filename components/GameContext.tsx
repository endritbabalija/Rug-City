'use client'

import { createContext, useContext } from 'react'
import type { CaseSummary } from '@/lib/cases'
import type { Sku } from '@/lib/catalog'
import type { PublicPlayer } from '@/lib/server'

export type Screen = { name: 'home' } | { name: 'shop' } | { name: 'profile' } | { name: 'leaderboard' } | { name: 'room'; code: string }

export interface GameCtx {
  player: PublicPlayer
  setPlayer: (p: PublicPlayer) => void
  cases: CaseSummary[]
  skus: Sku[]
  badges: Record<string, { name: string; icon: string }>
  /** Feature flags the client needs (lib/flags.ts). */
  flags: { season_banner: boolean }
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
