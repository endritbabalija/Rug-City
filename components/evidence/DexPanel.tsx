'use client'

import { useEffect, useRef, useState } from 'react'
import { HELP_PENALTY } from '@/lib/game/scoring'
import type { PhaseProps } from '../Room'
import { Button, Countdown, Label } from '../ui'
import { ClueCard } from './ClueCard'

const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * Detective Dex. Solo, he shows his clues one at a time when asked; in a crew his notes go
 * public on a timer. Either way anyone can ask him for a couple of hints.
 */
export function DexPanel({ room, run, busy, now }: PhaseProps) {
  const dex = room.dex!
  const crew = room.mode === 'crew'
  const [confirmHint, setConfirmHint] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!crew) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [crew, dex.messages.length])

  async function hint() {
    setConfirmHint(false)
    await run({ type: 'askDex', ask: 'hint' }, 'dexHint')
  }

  let clueIndex = 0
  return (
    <div className="px-4">
      <p className="text-sm text-dim">
        {crew
          ? "Dex puts his evidence on the table for the whole crew, one note every couple of minutes. He doesn't vote."
          : "Dex holds the rest of the evidence. Ask and he'll show you, one piece at a time."}
      </p>
      <div className="mt-4 space-y-4">
        {dex.messages.map((m, i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-start">
              <div className="paper max-w-[82%] animate-rise rounded-lg rounded-bl-sm px-3.5 py-2.5 font-type text-[15px] leading-snug">
                <div className="mb-1 font-mono text-[10px] font-bold text-rug">🕵️ DEX</div>
                {m.text}
              </div>
            </div>
            {m.hint && (
              <div className="rounded-md border border-tape/40 bg-tape/10 p-3 text-[15px]">
                <span className="mr-2 font-display font-black text-tape">Hint</span>
                {m.hint}
              </div>
            )}
            {m.clue && <ClueCard clue={m.clue} index={clueIndex++} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {crew && (
        <section className="mt-6">
          <Label>Dex&apos;s notes · shared with the crew</Label>
          <div className="mt-3 space-y-6">
            {dex.shared.map((c, i) => (
              <ClueCard key={c.id} clue={c} index={i} />
            ))}
          </div>
          <div className="mt-3 text-sm text-dim">
            {dex.nextReleaseAt !== null ? (
              <Countdown endsAt={dex.nextReleaseAt} now={now} label={`Next note (${dex.cluesLeft} left)`} />
            ) : (
              'Dex has shared everything he has.'
            )}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-2 border-t border-line pt-4">
        {!crew && (
          <Button className="w-full" disabled={dex.cluesLeft <= 0} busy={busy === 'dexClue'} onClick={() => run({ type: 'askDex', ask: 'clue' }, 'dexClue')}>
            {dex.cluesLeft > 0 ? `What have you got? (${dex.cluesLeft})` : 'Dex has shown you everything'}
          </Button>
        )}
        {confirmHint ? (
          <div className="rounded-md border border-rug/60 bg-ink-2 p-3">
            <p className="text-sm text-paper/85">
              A Dex hint costs {pct(HELP_PENALTY.dexHint)} of the case score{crew ? ' for everyone in the crew' : ''}. Ask anyway?
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" className="flex-1" busy={busy === 'dexHint'} onClick={hint}>
                Give me the hint
              </Button>
              <Button variant="ghost" onClick={() => setConfirmHint(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full" disabled={dex.hintsLeft <= 0} busy={busy === 'dexHint'} onClick={() => setConfirmHint(true)}>
            {dex.hintsLeft > 0 ? `💡 Give me a hint (${dex.hintsLeft} left · −${pct(HELP_PENALTY.dexHint)})` : 'Dex is out of hints'}
          </Button>
        )}
      </div>
    </div>
  )
}
