'use client'

import type { RunView } from '@/lib/investigation/view'
import { Button, Label, Stamp } from '../ui'
import { TextLink } from './shared'

export function CaseDesk({
  run,
  pins,
  onInspect,
  onPerson,
  onCompare,
  onTimeline,
  onHints,
  onAccuse,
  send,
}: {
  run: RunView
  pins: string[]
  onInspect: (id: string) => void
  onPerson: (id: string) => void
  onCompare: () => void
  onTimeline: () => void
  onHints: () => void
  onAccuse: () => void
  send: (action: { type: 'follow_lead'; lead: string }) => unknown
}) {
  const pinned = run.people.flatMap((p) => p.statements.filter((s) => pins.includes(s.id)).map((s) => ({ ...s, person: p })))

  return (
    <div className="space-y-6 px-4">
      <section className="paper rounded-sm p-4">
        <div className="font-type text-[12px] tracking-wide text-rug uppercase">Current question</div>
        <p className="mt-1 font-display text-2xl leading-tight font-black uppercase">{run.question}</p>
      </section>

      {run.dex && (
        <section className="flex gap-3">
          <div aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-tape font-display font-black text-tape">
            D
          </div>
          <p className="text-[15px] leading-snug text-paper/85">
            <b className="text-tape">Dex:</b> {run.dex}
          </p>
        </section>
      )}

      <section>
        <Label>Findings</Label>
        {run.findings.length === 0 ? (
          <p className="mt-2 text-sm text-dim">Nothing proved yet. Compare records to establish what they show.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {run.findings.map((f) => (
              <div key={f.id} className="rounded-md border border-ok/50 bg-ink-2 p-3">
                <div className="flex items-start gap-3">
                  <Stamp tone="ok" className="shrink-0 text-xs">
                    Proved
                  </Stamp>
                  <p className="text-[15px] leading-snug">{f.claim}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
                  {f.support.map((e) => (
                    <TextLink key={e.id} onClick={() => onInspect(e.id)}>
                      {e.title}
                    </TextLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {run.leads.length > 0 && (
        <section>
          <Label>Open leads</Label>
          <ul className="mt-1">
            {run.leads.map((l) => (
              <li key={l.id}>
                {l.kind === 'topic' ? (
                  <TextLink onClick={() => onPerson(l.person)}>
                    {l.personName}: {l.label.charAt(0).toLowerCase() + l.label.slice(1)}
                  </TextLink>
                ) : (
                  <TextLink
                    onClick={() => {
                      void send({ type: 'follow_lead', lead: l.id })
                    }}
                  >
                    {l.label}
                  </TextLink>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pinned.length > 0 && (
        <section>
          <Label>Pinned statements</Label>
          <div className="mt-2 space-y-2">
            {pinned.map((s) => (
              <button key={s.id} type="button" onClick={() => onPerson(s.person.id)} className="block w-full rounded-md border border-line p-3 text-left">
                <span className="font-mono text-[11px] text-dim">{s.person.name} · testimony{s.changed ? ' · story changed' : ''}</span>
                <p className={`font-type text-[15px] leading-snug ${s.changed ? 'line-through' : ''}`}>“{s.text}”</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 pb-6">
        <Button onClick={onCompare}>Compare records</Button>
        {run.timeline && (
          <Button variant="ghost" onClick={onTimeline}>
            Arrange the timeline
          </Button>
        )}
        <Button variant="ghost" onClick={onHints}>
          Ask Dex for a hint
        </Button>
        {run.accusation && (
          <Button variant="danger" onClick={onAccuse}>
            Name who did it
          </Button>
        )}
      </section>
    </div>
  )
}
