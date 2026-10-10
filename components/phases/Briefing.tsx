'use client'

import type { PhaseProps } from '../Room'
import { SuspectCard } from '../evidence/SuspectCard'
import { Button, Label, Stamp } from '../ui'

export function Briefing({ room, run, busy }: PhaseProps) {
  const c = room.case
  const readyCount = room.players.filter((p) => p.ready).length

  return (
    <div className="pb-28">
      <section className="paper relative mx-4 mt-5 rounded-sm p-5">
        <div className="absolute top-4 right-4">
          <Stamp className="text-sm">Rugged</Stamp>
        </div>
        <div className="font-type text-xs tracking-widest text-paper-ink/60 uppercase">Case file · {c.project.ticker}</div>
        <h2 className="mt-1 font-display text-4xl leading-none font-black uppercase">{c.project.name}</h2>
        <p className="mt-1 font-type text-sm italic">{c.project.pitch}</p>
        <div className="mt-4 space-y-3 font-type text-[15px] leading-snug">
          {c.briefing.map((line, i) => (
            <p key={i} className="animate-rise" style={{ animationDelay: `${i * 120}ms` }}>
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-8 px-5">
        <Label>Timeline of the crash</Label>
        <ol className="relative mt-4 ml-2 space-y-4 border-l-2 border-dashed border-line pl-5">
          {c.timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-ink bg-rug" />
              <div className="font-mono text-xs text-tape">{t.at}</div>
              <div className="text-[15px] text-paper/90">{t.text}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 px-5">
        <Label>Suspects</Label>
        <div className="mt-3 space-y-3">
          {c.suspects.map((s) => (
            <SuspectCard key={s.id} suspect={s} />
          ))}
        </div>
        <p className="mt-4 text-sm text-dim">
          Next, each of you gets different evidence and one or two suspects will message you privately. Nobody can solve it alone.
        </p>
      </section>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-5 pt-3 pb-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex justify-between font-mono text-xs text-dim">
            <span>
              {readyCount}/{room.players.length} ready
            </span>
            <span>{room.players.filter((p) => !p.ready).map((p) => p.name).join(', ') || 'Everyone is in'}</span>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={room.me.ready} busy={busy === 'ready'} onClick={() => run({ type: 'ready' })}>
              {room.me.ready ? 'Waiting for crew…' : "I've read it"}
            </Button>
            {room.me.isHost && (
              <Button variant="ghost" busy={busy === 'skip'} onClick={() => run({ type: 'skip' })}>
                Start now
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
