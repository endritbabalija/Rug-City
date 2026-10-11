'use client'

import { useState } from 'react'
import type { OutcomeView, RunView } from '@/lib/investigation/view'
import { Button, Label, Sheet } from '../ui'
import { Chip, Feedback, type Send } from './shared'

/** Name a culprit and back each claim with findings. Nothing is final until the theory holds. */
export function Accusation({ run, onClose, send, activeMs }: { run: RunView; onClose: () => void; send: Send; activeMs: () => number }) {
  const acc = run.accusation!
  const [suspect, setSuspect] = useState<string | null>(null)
  const [slots, setSlots] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeView | null>(null)

  function toggle(slot: string, finding: string) {
    setOutcome(null)
    setSlots((s) => {
      const cur = s[slot] ?? []
      return { ...s, [slot]: cur.includes(finding) ? cur.filter((f) => f !== finding) : [...cur, finding] }
    })
  }

  async function submit() {
    if (!suspect) return
    setBusy(true)
    const o = await send({ type: 'accuse', suspect, slots, activeMs: Math.round(activeMs()) })
    setBusy(false)
    setOutcome(o)
  }

  return (
    <Sheet open onClose={onClose} title="Name who did it">
      <p className="text-sm text-dim">You can test a theory as often as you like. A wrong one costs nothing and you keep everything you’ve found.</p>

      <Label className="mt-5">Who is responsible?</Label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {acc.suspects.map((s) => (
          <Chip
            key={s.id}
            selected={suspect === s.id}
            onClick={() => {
              setOutcome(null)
              setSuspect(s.id)
            }}
          >
            {s.name}
          </Chip>
        ))}
      </div>

      {acc.slots.map((slot) => (
        <section key={slot.id} className="mt-5">
          <Label>{slot.label}</Label>
          <div className="mt-2 space-y-2">
            {run.findings.map((f) => (
              <Chip key={f.id} selected={(slots[slot.id] ?? []).includes(f.id)} onClick={() => toggle(slot.id, f.id)}>
                {f.claim}
              </Chip>
            ))}
          </div>
        </section>
      ))}

      <Feedback outcome={outcome} />
      <Button variant="danger" className="mt-5 w-full" busy={busy} disabled={!suspect} onClick={submit}>
        Submit theory
      </Button>
    </Sheet>
  )
}
