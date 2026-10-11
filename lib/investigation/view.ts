import { applies, findingIds, hintAvailable, lastApplicable, meets, personAvailable, statementVisible, type Outcome } from './rules'
import type { CaseDefinition, EvidenceKind, LineDef, Run, RunStatus } from './types'

// The projection: the only shape of a run that leaves the server. It holds discovered
// records, established findings, visible statements and topics, the transcript and the
// options available right now. Answer tables, locked records and future lines stay out.
// Client code imports types from here; it never imports `cases/*`.

export interface LineView {
  speaker: string | null
  text: string
}

export interface EvidenceRef {
  id: string
  title: string
}

export interface EvidenceView extends EvidenceRef {
  source: string
  kind: EvidenceKind
  time: string
  sections: { heading?: string; lines: string[] }[]
  explainer?: string
  leads: { id: string; label: string; followed: boolean }[]
  /** People this record lets you contact (e.g. a verified business listing). */
  contacts: { id: string; name: string }[]
}

export interface FindingView {
  id: string
  claim: string
  support: EvidenceRef[]
}

export interface StatementView {
  id: string
  text: string
  changed: boolean
  challenges: { id: string; text: string }[]
}

export interface TranscriptView {
  key: string
  at: number
  /** What the player asked or claimed. */
  prompt: string
  lines: LineView[]
  evidence: EvidenceRef[]
}

export interface PersonView {
  id: string
  name: string
  role: string
  kind: 'suspect' | 'contact'
  initials: string
  opening: LineView[]
  statements: StatementView[]
  topics: { id: string; label: string; asked: boolean }[]
  transcript: TranscriptView[]
}

export type LeadView =
  | { kind: 'topic'; id: string; person: string; personName: string; label: string }
  | { kind: 'lead'; id: string; evidence: string; label: string }

export interface HintView {
  id: string
  title: string
  revealed: string[]
}

export interface RunView {
  runId: string
  caseId: string
  caseVersion: number
  status: RunStatus
  title: string
  intro: { from: string; message: string; headline: string }
  question: string
  dex: string | null
  evidence: EvidenceView[]
  findings: FindingView[]
  people: PersonView[]
  /** Claims that can be tested now and aren't established yet. */
  claims: { id: string; text: string }[]
  leads: LeadView[]
  hints: HintView[]
  timeline: { claim: string; submit: string[]; items: { evidence: string; label: string; time: string; minute: number }[] } | null
  accusation: { suspects: { id: string; name: string }[]; slots: { id: string; label: string }[] } | null
  ending: { title: string; paragraphs: string[]; closing: LineView[]; teaser: string } | null
}

/** An action's result, with ids turned into what the player can already see. */
export interface OutcomeView {
  ok: boolean
  feedback?: string
  evidence?: EvidenceRef[]
  finding?: string
  transcript?: string
  repeat?: boolean
  resolved?: boolean
}

function speakerName(def: CaseDefinition, speaker: string): string | null {
  if (speaker === 'narrator') return null
  if (speaker === 'dex') return 'Dex'
  return def.people.find((p) => p.id === speaker)?.name ?? null
}

const lineView = (def: CaseDefinition, l: LineDef): LineView => ({ speaker: speakerName(def, l.speaker), text: l.text })

function evidenceRef(def: CaseDefinition, id: string): EvidenceRef {
  const e = def.evidence.find((x) => x.id === id)!
  return { id, title: e.title }
}

export function project(def: CaseDefinition, run: Run): RunView {
  const p = run.progress
  const known = new Set(p.evidence)
  const established = findingIds(p)
  const people = def.people.filter((person) => meets(p, person.available))

  const evidence: EvidenceView[] = def.evidence
    .filter((e) => known.has(e.id))
    .map((e) => ({
      id: e.id,
      title: e.title,
      source: e.source,
      kind: e.kind,
      time: e.time,
      sections: e.sections,
      explainer: e.explainer,
      leads: def.leads.filter((l) => l.evidence === e.id).map((l) => ({ id: l.id, label: l.label, followed: p.leads.includes(l.id) })),
      contacts: people.filter((person) => person.available.evidence?.includes(e.id)).map((person) => ({ id: person.id, name: person.name })),
    }))

  const findings: FindingView[] = p.findings.map((f) => ({
    id: f.id,
    claim: def.claims.find((c) => c.id === f.id)!.text,
    support: f.support.map((id) => evidenceRef(def, id)),
  }))

  const transcriptFor = (personId: string): TranscriptView[] =>
    p.transcript.flatMap(({ key, at }) => {
      const topic = def.topics.find((t) => t.id === key)
      if (topic) {
        if (topic.person !== personId) return []
        return [{ key, at, prompt: topic.label, lines: topic.lines.map((id) => lineView(def, def.lines[id])), evidence: (topic.unlocks ?? []).map((id) => evidenceRef(def, id)) }]
      }
      const challenge = def.challenges.find((c) => c.id === key)
      const statement = challenge && def.statements.find((s) => s.id === challenge.statement)
      if (!challenge?.confrontation || statement?.person !== personId) return []
      const c = challenge.confrontation
      return [{ key, at, prompt: challenge.text, lines: c.lines.map((id) => lineView(def, def.lines[id])), evidence: (c.unlocks ?? []).map((id) => evidenceRef(def, id)) }]
    })

  const personViews: PersonView[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    kind: person.kind,
    initials: person.initials,
    opening: person.opening.map((id) => lineView(def, def.lines[id])),
    statements: def.statements
      .filter((s) => s.person === person.id && statementVisible(def, p, s.id))
      .map((s) => ({
        id: s.id,
        text: s.text,
        changed: !!s.changedBy && p.confrontations.includes(s.changedBy),
        challenges: def.challenges
          .filter((c) => c.statement === s.id && meets(p, c.visible) && !(c.confrontation && p.confrontations.includes(c.id)))
          .map((c) => ({ id: c.id, text: c.text })),
      })),
    topics: def.topics
      .filter((t) => t.person === person.id && meets(p, t.requires))
      .map((t) => ({ id: t.id, label: t.label, asked: p.topics.includes(t.id) })),
    transcript: transcriptFor(person.id),
  }))

  const leads: LeadView[] = [
    ...def.topics
      .filter((t) => !p.topics.includes(t.id) && personAvailable(def, p, t.person) && meets(p, t.requires) && Object.keys(t.requires).length > 0)
      .map((t) => ({ kind: 'topic' as const, id: t.id, person: t.person, personName: speakerName(def, t.person) ?? '', label: t.label })),
    ...def.leads
      .filter((l) => known.has(l.evidence) && !p.leads.includes(l.id))
      .map((l) => ({ kind: 'lead' as const, id: l.id, evidence: l.evidence, label: l.label })),
  ]

  const tl = def.timeline
  const timeline =
    tl && meets(p, tl.requires) && !established.includes(tl.claim)
      ? {
          claim: tl.claim,
          submit: tl.submit,
          items: tl.items.map((item) => {
            const e = def.evidence.find((x) => x.id === item.evidence)!
            return { evidence: item.evidence, label: item.label, time: e.time, minute: e.minute }
          }),
        }
      : null

  const resolved = run.status === 'resolved'

  return {
    runId: run.id,
    caseId: def.id,
    caseVersion: def.version,
    status: run.status,
    title: def.title,
    intro: def.intro,
    question: lastApplicable(p, def.questions) ?? '',
    dex: resolved ? null : lastApplicable(p, def.dex),
    evidence,
    findings,
    people: personViews,
    claims: resolved ? [] : def.claims.filter((c) => meets(p, c.visible) && !established.includes(c.id)).map((c) => ({ id: c.id, text: c.text })),
    leads: resolved ? [] : leads,
    hints: resolved
      ? []
      : def.hints
          .filter((h) => hintAvailable(def, p, h.id))
          .map((h) => ({ id: h.id, title: h.title, revealed: h.levels.slice(0, p.hints[h.id] ?? 0) })),
    timeline: resolved ? null : timeline,
    accusation:
      !resolved && meets(p, def.accusation.available)
        ? {
            suspects: def.accusation.suspects.map((id) => ({ id, name: speakerName(def, id) ?? id })),
            slots: def.accusation.slots.map((s) => ({ id: s.id, label: s.label })),
          }
        : null,
    ending: resolved
      ? {
          title: def.ending.title,
          paragraphs: def.ending.reconstruction.filter((l) => applies(p, l)).map((l) => l.text),
          closing: def.ending.closing.map((l) => lineView(def, l)),
          teaser: def.ending.teaser,
        }
      : null,
  }
}

export function projectOutcome(def: CaseDefinition, o: Outcome): OutcomeView {
  return {
    ok: o.ok,
    feedback: o.feedback,
    evidence: o.evidence?.length ? o.evidence.map((id) => evidenceRef(def, id)) : undefined,
    finding: o.finding,
    transcript: o.transcript,
    repeat: o.repeat,
    resolved: o.resolved,
  }
}
