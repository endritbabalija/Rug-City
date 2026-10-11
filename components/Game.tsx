'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, isTelegram, launchRoomCode } from '@/lib/client/api'
import type { CaseSummary, DistrictSummary } from '@/lib/cases'
import type { Sku } from '@/lib/catalog'
import type { PublicPlayer } from '@/lib/server'
import { bindBackButton, haptic, initTelegram, openInvoice } from '@/lib/telegram/webapp'
import { GameContext, type GameCtx, type Screen } from './GameContext'
import { CaseReview, CaseReviewList } from './admin/CaseReview'
import { District } from './District'
import { Home } from './Home'
import { Leaderboard } from './Leaderboard'
import { Profile } from './Profile'
import { Room } from './Room'
import { Shop } from './Shop'
import { Tape } from './ui'

interface MeResponse {
  player: PublicPlayer
  cases: CaseSummary[]
  districts: DistrictSummary[]
  nextDrop: string | null
  nextCase: GameCtx['nextCase']
  skus: Sku[]
  badges: GameCtx['badges']
  flags: GameCtx['flags']
  isAdmin: boolean
}

interface Toast {
  id: number
  text: string
  tone: 'info' | 'error' | 'ok'
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Game() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    if (tone === 'error') haptic.error()
    if (tone === 'ok') haptic.ok()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  useEffect(() => {
    initTelegram()
    api<MeResponse>('/api/me')
      .then((res) => {
        setMe(res)
        const code = launchRoomCode()
        if (code) setScreen({ name: 'room', code })
      })
      .catch((e: unknown) => setBootError(e instanceof ApiError ? e.message : 'Could not reach the case files.'))
  }, [])

  // Telegram's native back button returns to the case board from anywhere else. A room binds
  // its own, which asks first mid-case.
  useEffect(() => {
    if (screen.name === 'room') return
    return bindBackButton(screen.name === 'home' ? null : () => setScreen({ name: 'home' }))
  }, [screen.name])

  const setPlayer = useCallback((player: PublicPlayer) => setMe((m) => (m ? { ...m, player } : m)), [])
  const refresh = useCallback(async () => setMe(await api<MeResponse>('/api/me')), [])

  const buy = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- existing code; deps are correct
    async (skuId: string) => {
      try {
        const res = await api<{ link: string } | { granted: true }>('/api/payments/invoice', { sku: skuId })
        if ('granted' in res) {
          setPlayer((await api<MeResponse>('/api/me')).player)
          toast('Added (dev mode, no Stars charged).', 'ok')
          return true
        }
        const status = await openInvoice(res.link)
        if (status !== 'paid') {
          if (status === 'failed') toast('Payment failed. You were not charged.', 'error')
          return false
        }
        // The webhook grants the item; it usually lands within a second or two.
        const before = JSON.stringify(me?.player)
        for (let i = 0; i < 8; i++) {
          const fresh = (await api<MeResponse>('/api/me')).player
          if (JSON.stringify(fresh) !== before) {
            setPlayer(fresh)
            toast('Payment received. Thanks, detective!', 'ok')
            return true
          }
          await wait(800)
        }
        toast('Payment received. Your item will appear in a moment.', 'info')
        return true
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Could not start the payment.', 'error')
        return false
      }
    },
    [me?.player, setPlayer, toast],
  )

  const ctx = useMemo<GameCtx | null>(
    () =>
      me
        ? {
            player: me.player,
            setPlayer,
            refresh,
            cases: me.cases,
            districts: me.districts,
            nextDrop: me.nextDrop,
            nextCase: me.nextCase,
            skus: me.skus,
            badges: me.badges,
            flags: me.flags,
            isAdmin: me.isAdmin,
            go: setScreen,
            toast,
            buy,
          }
        : null,
    [me, setPlayer, refresh, toast, buy],
  )

  if (bootError) {
    return (
      <main className="safe-top grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <Tape className="mb-6">Access denied</Tape>
          <p className="font-display text-3xl font-black uppercase">{bootError}</p>
          {!isTelegram() && <p className="mt-3 text-sm text-dim">Open the game from Telegram through the bot.</p>}
        </div>
      </main>
    )
  }

  if (!ctx) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="animate-flicker font-display text-2xl font-black uppercase tracking-[0.3em] text-tape">Opening case files…</p>
      </main>
    )
  }

  return (
    <GameContext.Provider value={ctx}>
      <main className="safe-top safe-bottom mx-auto min-h-dvh max-w-xl">
        {screen.name === 'home' && <Home />}
        {screen.name === 'shop' && <Shop />}
        {screen.name === 'profile' && <Profile />}
        {screen.name === 'leaderboard' && <Leaderboard />}
        {screen.name === 'district' && <District key={screen.id} id={screen.id} />}
        {screen.name === 'admin' && ctx.isAdmin && <CaseReviewList />}
        {screen.name === 'adminCase' && ctx.isAdmin && <CaseReview key={screen.id} id={screen.id} />}
        {screen.name === 'room' && <Room key={screen.code} code={screen.code} />}
      </main>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3 safe-top">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise rounded-md px-4 py-2.5 text-sm font-semibold shadow-xl ${
              t.tone === 'error' ? 'bg-rug text-paper' : t.tone === 'ok' ? 'bg-ok text-ink' : 'paper'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </GameContext.Provider>
  )
}
