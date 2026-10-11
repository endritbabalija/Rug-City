'use client'

import { useState } from 'react'
import type { CaseSummary } from '@/lib/cases'
import { api, ApiError } from '@/lib/client/api'
import { useGame } from './GameContext'
import { Button, Stamp } from './ui'

/** A case file on the board, with buttons to host it or play it solo. */
export function CaseCard({ c, index, showPlayed = false }: { c: CaseSummary; index: number; showPlayed?: boolean }) {
  const { flags, go, toast } = useGame()
  const [busy, setBusy] = useState<'crew' | 'solo' | null>(null)

  async function open(solo: boolean) {
    setBusy(solo ? 'solo' : 'crew')
    try {
      const res = await api<{ code: string }>(solo ? '/api/solo' : '/api/rooms', { caseId: c.id })
      go({ name: 'room', code: res.code })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not open the case.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="paper relative animate-rise overflow-hidden rounded-sm p-5" style={{ animationDelay: `${index * 90}ms`, rotate: `${index % 2 ? 0.6 : -0.5}deg` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-type text-xs tracking-widest text-paper-ink/60 uppercase">Case {(index + 1).toString().padStart(2, '0')} · {c.ticker}</div>
        <div className="font-type text-xs text-paper-ink/60">{c.suspects} suspects</div>
      </div>
      {showPlayed && (
        <div className="absolute top-9 right-4">
          {c.played ? (
            <Stamp tone="ok" className="text-xs">
              Closed
            </Stamp>
          ) : (
            <Stamp className="text-xs">New</Stamp>
          )}
        </div>
      )}
      <h2 className="mt-2 font-display text-[2.1rem] leading-none font-black uppercase">{c.title}</h2>
      <p className="mt-1 font-type text-sm font-bold text-rug uppercase">{c.crime}</p>
      <p className="mt-3 font-type text-[15px] leading-snug">{c.tagline}</p>
      <Button className="mt-4 w-full" busy={busy === 'crew'} onClick={() => open(false)}>
        Host this case
      </Button>
      {flags.solo && (
        <Button variant="paper" className="mt-2 w-full border border-paper-ink/30" busy={busy === 'solo'} onClick={() => open(true)}>
          🕵️ Play solo with Dex
        </Button>
      )}
    </article>
  )
}
