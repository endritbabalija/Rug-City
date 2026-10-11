'use client'

import { useState } from 'react'
import type { LineView, OutcomeView, PersonView, RunView, StatementView } from '@/lib/investigation/view'
import { Button, Label, Pill, Sheet } from '../ui'
import { Avatar, Chip, Feedback, TextLink, type Send } from './shared'

export function PeopleList({ run, onSelect }: { run: RunView; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-3 px-4">
      {run.people.map((p) => {
        const fresh = p.topics.filter((t) => !t.asked).length
        return (
          <button key={p.id} type="button" onClick={() => onSelect(p.id)} className="flex w-full items-center gap-3 rounded-md border border-line bg-ink-2 p-3 text-left active:bg-ink-3">
            <Avatar initials={p.initials} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-display text-lg leading-tight font-bold uppercase">{p.name}</span>
                <span className="shrink-0 font-mono text-[11px] tracking-wider text-tape uppercase">{p.role}</span>
              </div>
              {p.statements.at(-1) && <p className="truncate text-sm text-dim italic">“{p.statements.at(-1)!.text}”</p>}
            </div>
            {fresh > 0 && <Pill tone="tape">{fresh} to ask</Pill>}
          </button>
        )
      })}
    </div>
  )
}

function Bubble({ line }: { line: LineView }) {
  if (!line.speaker) return <p className="text-center font-type text-sm text-dim italic">{line.text}</p>
  return (
    <div className="max-w-[88%]">
      <div className="mb-0.5 font-mono text-[11px] text-dim">{line.speaker}</div>
      <div className="paper rounded-lg rounded-bl-sm px-3.5 py-2.5 font-type text-[15px] leading-snug">{line.text}</div>
    </div>
  )
}

export function PersonDetail({
  run,
  person,
  send,
  pins,
  onTogglePin,
  onInspect,
  onBack,
}: {
  run: RunView
  person: PersonView
  send: Send
  pins: string[]
  onTogglePin: (statementId: string) => void
  onInspect: (evidenceId: string) => void
  onBack: () => void
}) {
  const [challenging, setChallenging] = useState<StatementView | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const closed = !!run.ending

  async function ask(topic: string) {
    setAsking(topic)
    await send({ type: 'open_topic', topic })
    setAsking(null)
  }

  return (
    <div className="px-4">
      <TextLink onClick={onBack}>← All people</TextLink>
      <div className="mt-1 flex items-center gap-3">
        <Avatar initials={person.initials} />
        <div>
          <h2 className="font-display text-2xl leading-none font-black uppercase">{person.name}</h2>
          <div className="font-mono text-xs tracking-wider text-tape uppercase">{person.role}</div>
        </div>
      </div>

      {person.statements.length > 0 && (
        <section className="mt-5">
          <Label>Statements · testimony, not proof</Label>
          <div className="mt-2 space-y-2">
            {person.statements.map((s) => (
              <div key={s.id} className={`rounded-md border p-3 ${s.changed ? 'border-line opacity-75' : 'border-tape/50'}`}>
                <p className={`font-type text-[15px] leading-snug ${s.changed ? 'line-through decoration-rug/70' : ''}`}>“{s.text}”</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {s.changed && <Pill tone="rug">Story changed</Pill>}
                  <button type="button" onClick={() => onTogglePin(s.id)} aria-pressed={pins.includes(s.id)} className="min-h-11 px-2 text-sm text-dim underline underline-offset-4">
                    {pins.includes(s.id) ? 'Unpin' : 'Pin to desk'}
                  </button>
                  {!closed && !s.changed && s.challenges.length > 0 && (
                    <Button variant="danger" className="ml-auto !min-h-11 !px-4 !text-base" onClick={() => setChallenging(s)}>
                      Challenge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <Label>Conversation</Label>
        <div className="mt-2 space-y-3">
          {person.opening.map((l, i) => (
            <Bubble key={i} line={l} />
          ))}
          {person.transcript.map((t) => (
            <div key={t.key} className="space-y-2">
              <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-tape px-3.5 py-2 text-[15px] leading-snug text-ink">{t.prompt}</div>
              {t.lines.map((l, i) => (
                <Bubble key={i} line={l} />
              ))}
              {t.evidence.map((e) => (
                <button key={e.id} type="button" onClick={() => onInspect(e.id)} className="flex min-h-11 w-full items-center gap-2 rounded-md border border-dashed border-tape/60 px-3 text-left text-sm">
                  <span className="font-display font-bold tracking-wider text-tape uppercase">New record</span>
                  <span className="flex-1">{e.title}</span>
                  <span aria-hidden>→</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {!closed && person.topics.length > 0 && (
        <section className="mt-6 pb-4">
          <Label>Ask</Label>
          <div className="mt-2 space-y-2">
            {person.topics.map((t) => (
              <Button key={t.id} variant="ghost" className="w-full !justify-start !text-left !text-base !normal-case" busy={asking === t.id} onClick={() => ask(t.id)}>
                {t.label}
                {t.asked && <span className="ml-2 font-sans text-xs text-dim">· asked</span>}
              </Button>
            ))}
          </div>
        </section>
      )}

      {challenging && <ChallengeSheet run={run} statement={challenging} send={send} onClose={() => setChallenging(null)} />}
    </div>
  )
}

/** Challenge a statement: pick what you're claiming, attach records and findings. */
function ChallengeSheet({ run, statement, send, onClose }: { run: RunView; statement: StatementView; send: Send; onClose: () => void }) {
  const [challenge, setChallenge] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<string[]>([])
  const [findings, setFindings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeView | null>(null)

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => {
    setOutcome(null)
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function submit() {
    if (!challenge) return
    setBusy(true)
    const o = await send({ type: 'confront', challenge, evidence, findings })
    setBusy(false)
    setOutcome(o)
    if (o?.ok) onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Challenge">
      <p className="font-type text-[15px] leading-snug text-paper/85">“{statement.text}”</p>

      <Label className="mt-5">Your point</Label>
      <div className="mt-2 space-y-2">
        {statement.challenges.map((c) => (
          <Chip
            key={c.id}
            selected={challenge === c.id}
            onClick={() => {
              setOutcome(null)
              setChallenge(challenge === c.id ? null : c.id)
            }}
          >
            {c.text}
          </Chip>
        ))}
      </div>

      {run.findings.length > 0 && (
        <>
          <Label className="mt-5">Attach findings</Label>
          <div className="mt-2 space-y-2">
            {run.findings.map((f) => (
              <Chip key={f.id} selected={findings.includes(f.id)} onClick={() => toggle(findings, setFindings, f.id)}>
                {f.claim}
              </Chip>
            ))}
          </div>
        </>
      )}

      <Label className="mt-5">Attach records</Label>
      <div className="mt-2 space-y-2">
        {run.evidence.map((e) => (
          <Chip key={e.id} selected={evidence.includes(e.id)} onClick={() => toggle(evidence, setEvidence, e.id)}>
            {e.title} <span className="font-mono text-xs text-dim">· {e.time}</span>
          </Chip>
        ))}
      </div>

      <Feedback outcome={outcome} />
      <Button variant="danger" className="mt-5 w-full" busy={busy} disabled={!challenge} onClick={submit}>
        Challenge
      </Button>
    </Sheet>
  )
}
