'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, isTelegram } from '@/lib/client/api'
import type { RunView } from '@/lib/investigation/view'
import type { PublicPlayer } from '@/lib/server'
import { initTelegram } from '@/lib/telegram/webapp'
import { Home } from './Home'
import { Investigation } from './investigation/Investigation'
import { Tape } from './ui'

interface MeResponse {
  player: PublicPlayer
  features: { refund: boolean }
}

export function Game() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [run, setRun] = useState<RunView | null>(null)
  const goHome = useCallback(() => setRun(null), [])

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
      {run ? (
        // Keyed by run so a restart or a different run starts with fresh screen state.
        <Investigation key={run.runId} initial={run} onHome={goHome} />
      ) : (
        <Home player={me.player} refund={me.features.refund} onOpenRun={setRun} />
      )}
    </main>
  )
}
