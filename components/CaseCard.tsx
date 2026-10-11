'use client'

import { useState } from 'react'
import type { CaseSummary } from '@/lib/cases'
import { api, ApiError } from '@/lib/client/api'
import { MIN_PLAYERS } from '@/lib/game/types'
import { useGame } from './GameContext'
import { Button, Confirm, Stamp } from './ui'

/** A case file on the board, with buttons to host it or play it solo. */
export function CaseCard({ c, index }: { c: CaseSummary; index: number }) {
  const { flags, go, toast, buy } = useGame()
  const [busy, setBusy] = useState<'crew' | 'solo' | null>(null)
  const [confirmReplay, setConfirmReplay] = useState(false)

  async function open(solo: boolean) {
    setConfirmReplay(false)
    setBusy(solo ? 'solo' : 'crew')
    try {
      const path = solo ? '/api/solo' : '/api/rooms'
      const res = await api<{ code: string }>(path, { caseId: c.id }).catch(async (e: unknown) => {
        // Out of cases: offer a pack, the way the Lobby does, then try once more.
        if (!(solo && e instanceof ApiError && e.code === 'NO_CASES')) throw e
        toast(e.message)
        return (await buy('pack5')) ? api<{ code: string }>(path, { caseId: c.id }) : null
      })
      if (res) go({ name: 'room', code: res.code })
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
      <div className="absolute top-9 right-4">
        {c.played ? (
          <Stamp tone="ok" className="text-xs">
            Closed
          </Stamp>
        ) : (
          <Stamp className="text-xs">New</Stamp>
        )}
      </div>
      <h2 className="mt-2 font-display text-[2.1rem] leading-none font-black uppercase">{c.title}</h2>
      <p className="mt-1 font-type text-sm font-bold text-rug uppercase">{c.crime}</p>
      <p className="mt-3 font-type text-[15px] leading-snug">{c.tagline}</p>
      <Button className="mt-4 w-full" busy={busy === 'crew'} onClick={() => open(false)}>
        Host this case
      </Button>
      {flags.solo &&
        (confirmReplay ? (
          <div className="mt-2">
            <Confirm yes="Use a case" busy={busy === 'solo'} onYes={() => open(true)} onNo={() => setConfirmReplay(false)}>
              You&apos;ve closed this case. Replays earn no Clue Points. Use a case anyway?
            </Confirm>
          </div>
        ) : (
          <Button
            variant="paper"
            className="mt-2 w-full border border-paper-ink/30"
            busy={busy === 'solo'}
            onClick={() => (c.played ? setConfirmReplay(true) : open(true))}
          >
            🕵️ Play solo with Dex
          </Button>
        ))}
      <p className="mt-2 font-type text-xs text-paper-ink/70">
        {c.played ? "You've closed this one; your friends can still earn on it. " : ''}
        Host: invite {MIN_PLAYERS - 1}+ friends.{flags.solo ? ' Solo: you and Dex.' : ''}
      </p>
    </article>
  )
}
