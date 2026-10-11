'use client'

import type { EvidenceView, RunView } from '@/lib/investigation/view'
import { Button, Label, Sheet } from '../ui'
import { KIND_LABEL, type Send } from './shared'

const IDENT = /([A-Z]+-\d+)/g

/** Case identifiers (RELAY-72, TX-101…) in a record's text. */
export const identifiers = (e: EvidenceView) => new Set(e.sections.flatMap((s) => s.lines.join(' ').match(IDENT) ?? []))

function Marked({ text, highlight }: { text: string; highlight?: Set<string> }) {
  if (!highlight?.size) return <>{text}</>
  return (
    <>
      {text.split(IDENT).map((part, i) =>
        highlight.has(part) ? (
          <mark key={i} className="rounded-sm bg-tape/60 px-0.5 text-paper-ink underline decoration-2 underline-offset-2">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** A record's full text on paper. `highlight` marks identifiers shared with other selected records. */
export function EvidenceCard({ e, highlight }: { e: EvidenceView; highlight?: Set<string> }) {
  return (
    <article className="paper relative rounded-sm p-4 pt-5">
      <div className="absolute -top-2 left-5 h-5 w-16 rotate-[-3deg] bg-tape/80 shadow-sm" aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl leading-tight font-black uppercase">{e.title}</h3>
        <span className="shrink-0 font-mono text-[11px] text-paper-ink/60">{e.time}</span>
      </div>
      <div className="mb-3 font-type text-[12px] tracking-wide text-rug uppercase">
        {KIND_LABEL[e.kind]} · {e.source}
      </div>
      <div className="space-y-3 font-type text-[15px] leading-snug">
        {e.sections.map((s, i) => (
          <div key={i} className={s.heading ? 'rounded-sm bg-paper-2/70 p-3' : ''}>
            {s.heading && <p className="mb-1 font-mono text-[12px] font-bold text-paper-ink/70">{s.heading}</p>}
            {s.lines.map((l, j) => (
              <p key={j}>
                <Marked text={l} highlight={highlight} />
              </p>
            ))}
          </div>
        ))}
      </div>
      {e.explainer && (
        <p className="mt-3 border-t border-dashed border-paper-ink/25 pt-2 text-[13px] text-paper-ink/75">
          <b>What this means:</b> {e.explainer}
        </p>
      )}
    </article>
  )
}

export function EvidenceList({ run, onInspect }: { run: RunView; onInspect: (id: string) => void }) {
  return (
    <div className="space-y-3 px-4">
      <p className="text-sm text-dim">Records are what the documents say. People’s statements are testimony; findings are what you’ve proved.</p>
      {run.evidence.map((e) => (
        <button key={e.id} type="button" onClick={() => onInspect(e.id)} className="block w-full rounded-md border border-line bg-ink-2 p-3 text-left active:bg-ink-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-lg leading-tight font-bold uppercase">{e.title}</span>
            <span className="shrink-0 font-mono text-xs text-dim">{e.time}</span>
          </div>
          <div className="text-sm text-paper/70">
            {KIND_LABEL[e.kind]} · {e.source}
          </div>
        </button>
      ))}
    </div>
  )
}

/** Full view of one record, with the links it carries. */
export function EvidenceSheet({
  run,
  id,
  onClose,
  send,
  onCompare,
  onContact,
}: {
  run: RunView
  id: string | null
  onClose: () => void
  send: Send
  onCompare: (id: string) => void
  onContact: (personId: string) => void
}) {
  const e = run.evidence.find((x) => x.id === id)
  if (!e) return null
  return (
    <Sheet open onClose={onClose} title="Record">
      <EvidenceCard e={e} />
      {(e.leads.length > 0 || e.contacts.length > 0) && (
        <div className="mt-4 space-y-2">
          <Label>Leads in this record</Label>
          {e.leads.map((l) => (
            <Button key={l.id} variant="ghost" className="w-full !text-base" onClick={() => void send({ type: 'follow_lead', lead: l.id })}>
              {l.followed ? `${l.label} ✓` : l.label}
            </Button>
          ))}
          {e.contacts.map((c) => (
            <Button key={c.id} variant="ghost" className="w-full !text-base" onClick={() => onContact(c.id)}>
              Contact {c.name}
            </Button>
          ))}
        </div>
      )}
      {!run.ending && (
        <Button className="mt-4 w-full" onClick={() => onCompare(e.id)}>
          Compare with…
        </Button>
      )}
    </Sheet>
  )
}
