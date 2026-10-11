'use client'

import { useState } from 'react'
import type { RunView } from '@/lib/investigation/view'
import { Button, Confirm, Stamp, Tape } from '../ui'

export function Intro({ run, onOpen, busy }: { run: RunView; onOpen: () => void; busy: boolean }) {
  const from = run.people.find((p) => p.id === run.intro.from)
  return (
    <div className="flex min-h-[80dvh] flex-col px-5 pt-8 pb-8">
      <Tape>New client</Tape>
      <p className="mt-8 font-mono text-xs text-dim">MESSAGE FROM {from?.name.toUpperCase()} · {from?.role.toUpperCase()}</p>
      <div className="paper mt-2 rounded-lg rounded-bl-sm px-4 py-3 font-type text-[16px] leading-snug">{run.intro.message}</div>
      <h1 className="mt-10 font-display text-5xl leading-[0.9] font-black uppercase">{run.intro.headline}</h1>
      <div className="mt-auto pt-10">
        <Button className="w-full" busy={busy} onClick={onOpen}>
          Open the case
        </Button>
      </div>
    </div>
  )
}

export function Ending({ run, onReview, onRestart, onHome }: { run: RunView; onReview: () => void; onRestart: () => Promise<void>; onHome: () => void }) {
  const ending = run.ending!
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <div className="px-5 pt-6 pb-10">
      <Stamp tone="ok" className="text-3xl">
        {ending.title}
      </Stamp>
      <h1 className="mt-6 font-display text-4xl leading-none font-black uppercase">{run.title}</h1>

      <section className="paper mt-6 space-y-3 rounded-sm p-4 font-type text-[15px] leading-snug">
        {ending.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <section className="mt-6 space-y-3">
        {ending.closing.map((l, i) =>
          l.speaker ? (
            <p key={i} className="text-[15px] leading-snug">
              <b className="text-tape">{l.speaker}:</b> “{l.text}”
            </p>
          ) : (
            <p key={i} className="font-type text-sm text-dim italic">
              {l.text}
            </p>
          ),
        )}
      </section>

      <div className="mt-8 grid gap-3">
        <Button variant="ghost" onClick={onReview}>
          Review evidence
        </Button>
        {confirm ? (
          <Confirm
            yes="Start over"
            busy={busy}
            onYes={async () => {
              setBusy(true)
              await onRestart()
              setBusy(false)
            }}
            onNo={() => setConfirm(false)}
          >
            This starts a new, separate run of the prototype from the beginning. This run stays as it is.
          </Confirm>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            Restart prototype
          </Button>
        )}
        <Button variant="ghost" onClick={onHome}>
          Back home
        </Button>
      </div>

      {/* Deliberately not a button: there is no next chapter to launch or buy. */}
      <p className="mt-8 rounded-md border border-dashed border-line px-3 py-3 text-center text-sm text-dim">{ending.teaser}</p>
    </div>
  )
}
