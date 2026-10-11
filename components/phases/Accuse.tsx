'use client'

import { useState } from 'react'
import { haptic } from '@/lib/telegram/webapp'
import type { PhaseProps } from '../Room'
import { Button, Confirm, Countdown, Label, useClock } from '../ui'

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        haptic.select()
        onClick()
      }}
      className={`w-full rounded-md border p-3 text-left text-[15px] leading-snug transition ${
        selected ? 'border-rug bg-rug/15 text-paper shadow-[inset_4px_0_0_var(--color-rug)]' : 'border-line bg-ink-2 text-paper/85'
      }`}
    >
      {children}
    </button>
  )
}

export function Accuse({ room, run, busy, now }: PhaseProps) {
  const c = room.case
  const [culprit, setCulprit] = useState(room.myVote?.culprit ?? '')
  const [motive, setMotive] = useState(room.myVote?.motive ?? '')
  const [trail, setTrail] = useState(room.myVote?.trail ?? '')
  const [confirmClose, setConfirmClose] = useState(false)
  const complete = culprit && motive && trail
  const at = useClock(now)
  const solo = room.mode === 'solo'
  const graceOver = room.accuseGraceEndsAt !== null && at >= room.accuseGraceEndsAt
  const canClose = room.votesIn > 0 && (room.me.isHost || graceOver)
  const missing = room.players.filter((p) => !p.voted)
  const names = (ps: { name: string }[]) =>
    ps.length < 2 ? (ps[0]?.name ?? '') : `${ps.slice(0, -1).map((p) => p.name).join(', ')} and ${ps.at(-1)!.name}`

  function close() {
    if (missing.length > 0 && !confirmClose) return setConfirmClose(true)
    setConfirmClose(false)
    void run({ type: 'closeVote' })
  }

  return (
    <div className="px-4 pt-5 pb-36">
      <h2 className="font-display text-5xl leading-[0.9] font-black uppercase">
        Name the <span className="text-rug">rugger</span>
      </h2>
      <p className="mt-2 text-sm text-dim">
        {solo ? 'Your answer is final once you lock it in.' : "The crew's majority is the verdict. Your own vote decides your Clue Points."}
      </p>

      <section className="mt-6">
        <Label>1 · Who did it? · 50 pts</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {c.suspects.map((s) => (
            <Choice key={s.id} selected={culprit === s.id} onClick={() => setCulprit(s.id)}>
              <div className="text-2xl">{s.avatar}</div>
              <div className="font-display text-lg leading-tight font-bold uppercase">{s.name}</div>
            </Choice>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <Label>2 · Why? · 25 pts</Label>
        <div className="mt-2 space-y-2">
          {c.motives.map((m) => (
            <Choice key={m.id} selected={motive === m.id} onClick={() => setMotive(m.id)}>
              {m.text}
            </Choice>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <Label>3 · Where did the money go? · 25 pts</Label>
        <div className="mt-2 space-y-2">
          {c.trails.map((t) => (
            <Choice key={t.id} selected={trail === t.id} onClick={() => setTrail(t.id)}>
              {t.text}
            </Choice>
          ))}
        </div>
      </section>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-5 pt-3 pb-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {!solo && (
            <div className="mb-2 flex items-center justify-between gap-3 font-mono text-xs text-dim">
              <span>
                {room.votesIn}/{room.players.length} voted · {missing.map((p) => p.name).join(', ') || 'all in'}
              </span>
              {room.accuseGraceEndsAt && !graceOver && !room.me.isHost && <Countdown endsAt={room.accuseGraceEndsAt} now={now} label="anyone can close in" />}
            </div>
          )}
          {!solo && !room.myVote && !room.me.isHost && <p className="mb-2 text-sm text-rug">Vote before the host closes it.</p>}
          {confirmClose && missing.length > 0 && (
            <div className="mb-2">
              <Confirm yes="Close anyway" busy={busy === 'closeVote'} onYes={close} onNo={() => setConfirmClose(false)}>
                {names(missing)} {missing.length === 1 ? "hasn't" : "haven't"} voted. Closing now means they earn nothing for this case.
              </Confirm>
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!complete} busy={busy === 'vote'} onClick={() => run({ type: 'vote', vote: { culprit, motive, trail } })}>
              {room.myVote ? 'Change vote' : 'Lock in vote'}
            </Button>
            {canClose && !confirmClose && (
              <Button variant="danger" busy={busy === 'closeVote'} onClick={close}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
