'use client'

import { useState } from 'react'
import type { OutcomeView, RunView } from '@/lib/investigation/view'
import { Button, Label, Sheet, Stamp } from '../ui'
import { EvidenceCard, identifiers } from './Evidence'
import { Chip, Feedback, type Send } from './shared'

const MAX_CARDS = 3

/** Pick records, pick a claim, submit. The server decides whether the records support it. */
export function Compare({ run, initial, onClose, send }: { run: RunView; initial: string[]; onClose: () => void; send: Send }) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [claim, setClaim] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeView | null>(null)
  const [established, setEstablished] = useState<string | null>(null)

  const cards = selected.map((id) => run.evidence.find((e) => e.id === id)).filter((e) => !!e)

  // After the player deliberately picks two or more records, mark identifiers they share.
  const counts = new Map<string, number>()
  if (cards.length > 1) for (const c of cards) for (const id of identifiers(c)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const shared = new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id))

  function toggle(id: string) {
    setOutcome(null)
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_CARDS ? [...s, id] : s))
  }

  async function submit() {
    if (!claim || !selected.length) return
    setBusy(true)
    const o = await send({ type: 'submit_finding', claim, evidence: selected })
    setBusy(false)
    setOutcome(o)
    if (o?.ok && o.finding) {
      setEstablished(run.claims.find((c) => c.id === claim)?.text ?? null)
      setClaim(null)
    }
  }

  return (
    <Sheet open onClose={onClose} title="Compare records">
      <Label>1 · Choose up to {MAX_CARDS} records</Label>
      <div className="mt-2 space-y-2">
        {run.evidence.map((e) => (
          <Chip key={e.id} selected={selected.includes(e.id)} disabled={!selected.includes(e.id) && selected.length >= MAX_CARDS} onClick={() => toggle(e.id)}>
            {e.title} <span className="font-mono text-xs whitespace-nowrap text-dim">· {e.time}</span>
          </Chip>
        ))}
      </div>

      {cards.length > 0 && (
        <div className="mt-5 space-y-4">
          {shared.size > 0 && <p className="text-sm text-dim">Marked: identifiers that appear in more than one selected record.</p>}
          {cards.map((e) => (
            <EvidenceCard key={e.id} e={e} highlight={shared} />
          ))}
        </div>
      )}

      <Label className="mt-6">2 · What do these records show?</Label>
      {run.claims.length === 0 ? (
        <p className="mt-2 text-sm text-dim">Nothing left to test right now. Follow your leads.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {run.claims.map((c) => (
            <Chip
              key={c.id}
              selected={claim === c.id}
              onClick={() => {
                setOutcome(null)
                setClaim(claim === c.id ? null : c.id)
              }}
            >
              {c.text}
            </Chip>
          ))}
        </div>
      )}

      <Feedback outcome={outcome} />
      {established && outcome?.ok && (
        <div role="status" className="mt-4 rounded-md border border-ok/60 p-3">
          <Stamp tone="ok" className="text-base">
            Finding
          </Stamp>
          <p className="mt-2 text-[15px]">{established}</p>
        </div>
      )}

      <Button className="mt-5 w-full" busy={busy} disabled={!claim || !selected.length} onClick={submit}>
        Submit finding
      </Button>
    </Sheet>
  )
}
