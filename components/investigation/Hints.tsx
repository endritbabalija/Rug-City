'use client'

import { useState } from 'react'
import type { RunView } from '@/lib/investigation/view'
import { Button, Label, Sheet } from '../ui'
import type { Send } from './shared'

const LEVELS = ['Nudge', 'Direction', 'Explicit help']

/** Free, layered, one level per request. Usage is recorded only to learn from playtests. */
export function Hints({ run, onClose, send }: { run: RunView; onClose: () => void; send: Send }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function more(step: string) {
    setBusy(step)
    await send({ type: 'request_hint', step })
    setBusy(null)
  }

  return (
    <Sheet open onClose={onClose} title="Ask Dex">
      <p className="text-sm text-dim">Hints are free and don’t affect anything. Take one level at a time.</p>
      {run.hints.length === 0 && <p className="mt-4 text-[15px]">Dex has nothing to add right now. Your leads are on the case desk.</p>}
      <div className="mt-4 space-y-5">
        {run.hints.map((h) => (
          <section key={h.id}>
            <Label>{h.title}</Label>
            <ol className="mt-2 space-y-2">
              {h.revealed.map((text, i) => (
                <li key={i} className="rounded-md border border-line bg-ink-2 p-3 text-[15px] leading-snug">
                  <span className="font-mono text-[11px] text-tape uppercase">{LEVELS[i]}</span>
                  <p>
                    <b className="text-tape">Dex:</b> {text}
                  </p>
                </li>
              ))}
            </ol>
            {h.revealed.length < LEVELS.length && (
              <Button variant="ghost" className="mt-2 w-full !text-base" busy={busy === h.id} onClick={() => more(h.id)}>
                {h.revealed.length === 0 ? 'Get a nudge' : `Show ${LEVELS[h.revealed.length].toLowerCase()}`}
              </Button>
            )}
          </section>
        ))}
      </div>
    </Sheet>
  )
}
