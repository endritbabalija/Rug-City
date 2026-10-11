'use client'

import { useEffect, useState } from 'react'
import { api, ApiError, isTelegram } from '@/lib/client/api'
import type { PublicPlayer } from '@/lib/server'
import { initTelegram } from '@/lib/telegram/webapp'
import { Home } from './Home'
import { Tape } from './ui'

interface MeResponse {
  player: PublicPlayer
}

export function Game() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    initTelegram()
    api<MeResponse>('/api/me')
      .then(setMe)
      .catch((e: unknown) => setBootError(e instanceof ApiError ? e.message : 'Could not reach the case files.'))
  }, [])

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

  if (!me) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="animate-flicker font-display text-2xl font-black uppercase tracking-[0.3em] text-tape">Opening case files…</p>
      </main>
    )
  }

  return (
    <main className="safe-top safe-bottom mx-auto min-h-dvh max-w-xl">
      <Home player={me.player} />
    </main>
  )
}
