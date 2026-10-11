'use client'

import { useState } from 'react'
import type { OutcomeView, RunView } from '@/lib/investigation/view'
import { Button, Sheet, Stamp } from '../ui'
import { Feedback, type Send } from './shared'

type Item = NonNullable<RunView['timeline']>['items'][number]

/** Start from an order that isn't already right, so arranging means something. */
function scrambled(items: Item[]): Item[] {
  const sorted = [...items].sort((a, b) => a.minute - b.minute)
  return [...sorted.slice(1), sorted[0]].reverse()
}

/**
 * Optional ordering aid. The order is checked here against times the player can already
 * see; a correct order then submits the finding through the server like any other.
 */
export function Timeline({ run, onClose, send }: { run: RunView; onClose: () => void; send: Send }) {
  const tl = run.timeline!
  const [order, setOrder] = useState<Item[]>(() => scrambled(tl.items))
  const [message, setMessage] = useState<string | null>(null)
  const [correct, setCorrect] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeView | null>(null)
  const claim = run.claims.find((c) => c.id === tl.claim)

  function move(i: number, by: -1 | 1) {
    const j = i + by
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    setMessage(null)
    setCorrect(false)
  }

  function check() {
    const wrong = order.findIndex((item, i) => i > 0 && order[i - 1].minute > item.minute)
    if (wrong === -1) {
      setCorrect(true)
      setMessage(null)
      return
    }
    const [a, b] = [order[wrong - 1], order[wrong]]
    setMessage(`“${a.label}” is at ${a.time}, but you placed it before “${b.label}” at ${b.time}.`)
  }

  async function submit() {
    setBusy(true)
    const o = await send({ type: 'submit_finding', claim: tl.claim, evidence: tl.submit })
    setBusy(false)
    setOutcome(o)
    if (o?.ok) onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Timeline">
      <p className="text-sm text-dim">Put these in the order they happened. Use the arrows.</p>
      <ol className="mt-4 space-y-2">
        {order.map((item, i) => (
          <li key={item.evidence} className="flex items-center gap-2 rounded-md border border-line bg-ink-2 p-2 pl-3">
            <span className="font-mono text-sm text-dim">{i + 1}.</span>
            <span className="flex-1 text-[15px]">
              {item.label} <span className="font-mono text-xs whitespace-nowrap text-dim">· {item.time}</span>
            </span>
            <button type="button" aria-label={`Move ${item.label} up`} disabled={i === 0} onClick={() => move(i, -1)} className="h-11 w-11 rounded-md border border-line disabled:opacity-30">
              ↑
            </button>
            <button type="button" aria-label={`Move ${item.label} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="h-11 w-11 rounded-md border border-line disabled:opacity-30">
              ↓
            </button>
          </li>
        ))}
      </ol>

      {message && (
        <p role="status" className="mt-3 rounded-md border border-rug/60 px-3 py-2 text-[15px]">
          {message}
        </p>
      )}

      {correct ? (
        <div className="mt-4" role="status">
          <Stamp tone="ok" className="text-base">
            In order
          </Stamp>
          {claim && <p className="mt-3 text-[15px] leading-snug">That supports a finding: “{claim.text}”</p>}
          <Feedback outcome={outcome} />
          <Button className="mt-4 w-full" busy={busy} onClick={submit}>
            Submit finding
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="mt-4 w-full" onClick={check}>
          Check order
        </Button>
      )}
    </Sheet>
  )
}
