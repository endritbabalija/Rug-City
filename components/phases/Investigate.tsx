'use client'

import { useState } from 'react'
import { haptic } from '@/lib/telegram/webapp'
import { ClueCard } from '../evidence/ClueCard'
import { Explorer } from '../evidence/Explorer'
import { Interrogation } from '../evidence/Interrogation'
import { useGame } from '../GameContext'
import type { PhaseProps } from '../Room'
import { Button, Countdown, Label } from '../ui'

type Tab = 'clues' | 'explorer' | 'suspects' | 'board'

export function Investigate(props: PhaseProps) {
  const { room, run, busy, now } = props
  const { player, buy } = useGame()
  const [tab, setTab] = useState<Tab>('clues')
  const overtime = room.investigateEndsAt !== null && now() >= room.investigateEndsAt
  const canCall = room.me.isHost || overtime
  const nameOf = (id: number) => room.players.find((p) => p.id === id)?.name ?? 'Someone'

  async function hint() {
    if (player.items.hint <= 0 && !(await buy('hint'))) return
    await run({ type: 'hint' }, 'hint')
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'clues', label: 'My clues', badge: room.myClues.length },
    { id: 'explorer', label: 'Explorer' },
    { id: 'suspects', label: 'Suspects', badge: room.mySuspects.length },
    { id: 'board', label: 'Board', badge: room.hints.length || undefined },
  ]

  return (
    <div>
      <div className="sticky top-[57px] z-20 border-b border-line bg-ink/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-2">
          {room.investigateEndsAt && <Countdown endsAt={room.investigateEndsAt} now={now} label="Time" />}
          <span className="font-mono text-[11px] text-dim">{room.players.length} detectives</span>
        </div>
        <nav className="scroll-x flex gap-1 overflow-x-auto px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                haptic.select()
                setTab(t.id)
              }}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2 font-display text-base font-bold tracking-wide uppercase transition ${
                tab === t.id ? 'border-tape text-paper' : 'border-transparent text-dim'
              }`}
            >
              {t.label}
              {t.badge ? <span className="rounded-full bg-ink-3 px-1.5 font-mono text-[10px] text-tape">{t.badge}</span> : null}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-5 pb-28">
        {tab === 'clues' && (
          <div className="space-y-6 px-4">
            <p className="text-sm text-dim">Only you can see these. Read them out, screenshot them, argue about them in the group chat.</p>
            {room.myClues.map((c, i) => (
              <ClueCard key={c.id} clue={c} index={i} />
            ))}
          </div>
        )}
        {tab === 'explorer' && <Explorer {...props} />}
        {tab === 'suspects' && <Interrogation {...props} />}
        {tab === 'board' && (
          <div className="px-4">
            <Label>Hints · shared with the crew</Label>
            <div className="mt-2 space-y-2">
              {room.hints.map((h, i) => (
                <div key={i} className="rounded-md border border-tape/40 bg-tape/10 p-3 text-[15px]">
                  <span className="mr-2 font-display font-black text-tape">#{i + 1}</span>
                  {h}
                </div>
              ))}
              {room.hints.length < room.case.hintCount ? (
                <Button variant="ghost" className="w-full" busy={busy === 'hint'} onClick={hint}>
                  💡 Reveal hint {room.hints.length + 1}/{room.case.hintCount} {player.items.hint > 0 ? `(${player.items.hint} left)` : '· ⭐10'}
                </Button>
              ) : (
                <p className="text-sm text-dim">All hints revealed.</p>
              )}
            </div>

            <Label className="mt-8">Case log</Label>
            <ol className="mt-2 space-y-1.5 font-mono text-xs">
              {[...room.feed].reverse().map((f, i) => (
                <li key={i} className="text-paper/75">
                  <span className="text-dim">{new Date(f.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> {f.text}
                </li>
              ))}
            </ol>

            <Label className="mt-8">Crew</Label>
            <p className="mt-1 text-sm text-paper/80">{room.players.map((p) => `${p.badge ?? ''}${p.name}`).join(' · ')}</p>
            <p className="mt-1 text-xs text-dim">Host: {nameOf(room.hostId)}</p>
          </div>
        )}
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-5 pt-3 pb-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {canCall ? (
            <Button variant="danger" className="w-full" busy={busy === 'callVote'} onClick={() => run({ type: 'callVote' })}>
              Call the vote
            </Button>
          ) : (
            <p className="py-2 text-center text-sm text-dim">
              {nameOf(room.hostId)} calls the vote when your crew is ready. Anyone can call it once time runs out.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
