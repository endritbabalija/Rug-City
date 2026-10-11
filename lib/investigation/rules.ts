import { AppError } from '../errors'
import type { Action, CaseDefinition, ContextLine, Requirement, Run, RunProgress } from './types'

// Pure rules for an investigation run. Each takes the case definition and the run and
// returns the next run (or null when nothing changed) plus an outcome, or throws AppError.
// Retries are safe: every unlock is a set-add, and a repeated action replays its outcome.

export interface Outcome {
  ok: boolean
  /** Specific, non-spoiling feedback on a wrong or unsupported theory. */
  feedback?: string
  /** Records unlocked by this action (only ones that were new). */
  evidence?: string[]
  finding?: string
  /** The conversation event this action produced or replayed. */
  transcript?: string
  repeat?: boolean
  hint?: string
  resolved?: boolean
}

export interface Result {
  run: Run | null
  outcome: Outcome
}

const NOT_AVAILABLE = () => new AppError('NOT_AVAILABLE', 'That isn’t available yet.')
const UNKNOWN_EVIDENCE = () => new AppError('UNKNOWN_EVIDENCE', 'Use only records you have found.')
const UNKNOWN_FINDING = () => new AppError('UNKNOWN_FINDING', 'Attach only findings you have established.')

const unique = (ids: string[]) => [...new Set(ids)]
const includesAll = (have: Iterable<string>, need: string[] = []) => {
  const set = new Set(have)
  return need.every((id) => set.has(id))
}

export function newProgress(def: CaseDefinition): RunProgress {
  return {
    evidence: [...def.initialEvidence],
    findings: [],
    confrontations: [],
    topics: [],
    leads: [],
    transcript: [],
    hints: {},
    accusation: null,
  }
}

export const findingIds = (p: RunProgress) => p.findings.map((f) => f.id)

export function meets(p: RunProgress, req: Requirement | undefined): boolean {
  if (!req) return true
  return (
    includesAll(p.evidence, req.evidence) &&
    includesAll(findingIds(p), req.findings) &&
    includesAll(p.confrontations, req.confrontations) &&
    includesAll(p.topics, req.topics)
  )
}

export const applies = (p: RunProgress, line: ContextLine) => meets(p, line.requires) && !(line.unless && meets(p, line.unless))

/** The last line whose requirement holds (case desk question, Dex, objections). */
export function lastApplicable(p: RunProgress, lines: ContextLine[]): string | null {
  let text: string | null = null
  for (const line of lines) if (applies(p, line)) text = line.text
  return text
}

function withProgress(run: Run, progress: RunProgress, now: number): Run {
  return { ...run, progress, updatedAt: now }
}

/** Add records, returning the progress and which ids were new. */
function unlock(p: RunProgress, ids: string[] = []): { progress: RunProgress; added: string[] } {
  const added = ids.filter((id) => !p.evidence.includes(id))
  return { progress: added.length ? { ...p, evidence: [...p.evidence, ...added] } : p, added }
}

function requireKnownEvidence(p: RunProgress, ids: string[]) {
  if (!includesAll(p.evidence, ids)) throw UNKNOWN_EVIDENCE()
}

function requireKnownFindings(p: RunProgress, ids: string[]) {
  if (!includesAll(findingIds(p), ids)) throw UNKNOWN_FINDING()
}

export function applyAction(def: CaseDefinition, run: Run, action: Action, now: number): Result {
  if (action.type === 'evidence_opened') {
    requireKnownEvidence(run.progress, [action.evidence])
    return { run: null, outcome: { ok: true } }
  }
  if (run.status === 'intro') {
    if (action.type !== 'open_case') throw new AppError('NOT_OPEN', 'Open the case first.')
    return { run: { ...run, status: 'investigating', updatedAt: now }, outcome: { ok: true } }
  }
  if (run.status === 'resolved') {
    // A retried winning accusation, or a second tab, sees the same result.
    if (action.type === 'accuse' || action.type === 'open_case') return { run: null, outcome: { ok: true, resolved: true, repeat: true } }
    throw new AppError('CLOSED', 'This case is closed.')
  }

  switch (action.type) {
    case 'open_case':
      return { run: null, outcome: { ok: true, repeat: true } }
    case 'open_topic':
      return openTopic(def, run, action.topic, now)
    case 'follow_lead':
      return followLead(def, run, action.lead, now)
    case 'submit_finding':
      return submitFinding(def, run, action.claim, action.evidence, now)
    case 'confront':
      return confront(def, run, action, now)
    case 'request_hint':
      return requestHint(def, run, action.step, now)
    case 'accuse':
      return accuse(def, run, action.suspect, action.slots, now)
  }
}

export function personAvailable(def: CaseDefinition, p: RunProgress, personId: string) {
  const person = def.people.find((x) => x.id === personId)
  return !!person && meets(p, person.available)
}

function openTopic(def: CaseDefinition, run: Run, topicId: string, now: number): Result {
  const p = run.progress
  const topic = def.topics.find((t) => t.id === topicId)
  if (!topic || !personAvailable(def, p, topic.person) || !meets(p, topic.requires)) throw NOT_AVAILABLE()
  if (p.topics.includes(topic.id)) return { run: null, outcome: { ok: true, repeat: true, transcript: topic.id } }

  const { progress, added } = unlock(p, topic.unlocks)
  const next = { ...progress, topics: [...p.topics, topic.id], transcript: [...p.transcript, { key: topic.id, at: now }] }
  return { run: withProgress(run, next, now), outcome: { ok: true, transcript: topic.id, evidence: added } }
}

function followLead(def: CaseDefinition, run: Run, leadId: string, now: number): Result {
  const p = run.progress
  const lead = def.leads.find((l) => l.id === leadId)
  if (!lead || !p.evidence.includes(lead.evidence)) throw NOT_AVAILABLE()
  if (p.leads.includes(lead.id)) return { run: null, outcome: { ok: true, repeat: true } }

  const { progress, added } = unlock(p, lead.unlocks)
  return { run: withProgress(run, { ...progress, leads: [...p.leads, lead.id] }, now), outcome: { ok: true, evidence: added } }
}

/**
 * Check a claim against the submitted records. Order and duplicates don't matter; a
 * superset of a supporting set is accepted, and the run keeps the subset that supports it.
 */
function submitFinding(def: CaseDefinition, run: Run, claimId: string, evidence: string[], now: number): Result {
  const p = run.progress
  const claim = def.claims.find((c) => c.id === claimId)
  if (!claim || !meets(p, claim.visible)) throw NOT_AVAILABLE()
  const submitted = unique(evidence)
  requireKnownEvidence(p, submitted)

  if (claim.support) {
    if (findingIds(p).includes(claim.id)) return { run: null, outcome: { ok: true, repeat: true, finding: claim.id } }
    const match = claim.support.find((set) => includesAll(submitted, set))
    if (match) {
      const next = { ...p, findings: [...p.findings, { id: claim.id, support: [...match] }] }
      return { run: withProgress(run, next, now), outcome: { ok: true, finding: claim.id } }
    }
  }
  const rule = claim.feedback.find((r) => includesAll(submitted, r.when))
  return { run: null, outcome: { ok: false, feedback: rule?.text ?? claim.fallback } }
}

export function statementVisible(def: CaseDefinition, p: RunProgress, statementId: string) {
  const s = def.statements.find((x) => x.id === statementId)
  return !!s && meets(p, s.visible)
}

function confront(def: CaseDefinition, run: Run, action: Extract<Action, { type: 'confront' }>, now: number): Result {
  const p = run.progress
  const challenge = def.challenges.find((c) => c.id === action.challenge)
  if (!challenge || !statementVisible(def, p, challenge.statement) || !meets(p, challenge.visible)) throw NOT_AVAILABLE()
  const evidence = unique(action.evidence)
  const findings = unique(action.findings)
  requireKnownEvidence(p, evidence)
  requireKnownFindings(p, findings)

  const c = challenge.confrontation
  if (!c) return { run: null, outcome: { ok: false, feedback: challenge.feedback } }
  if (p.confrontations.includes(challenge.id)) return { run: null, outcome: { ok: true, repeat: true, transcript: challenge.id } }
  if (!includesAll(evidence, c.evidence) || !includesAll(findings, c.findings)) return { run: null, outcome: { ok: false, feedback: c.insufficient } }

  const { progress, added } = unlock(p, c.unlocks)
  const next = {
    ...progress,
    confrontations: [...p.confrontations, challenge.id],
    transcript: [...p.transcript, { key: challenge.id, at: now }],
  }
  return { run: withProgress(run, next, now), outcome: { ok: true, transcript: challenge.id, evidence: added } }
}

export function hintAvailable(def: CaseDefinition, p: RunProgress, stepId: string) {
  const step = def.hints.find((h) => h.id === stepId)
  return !!step && meets(p, step.available) && !meets(p, step.done)
}

function requestHint(def: CaseDefinition, run: Run, stepId: string, now: number): Result {
  const p = run.progress
  if (!hintAvailable(def, p, stepId)) throw NOT_AVAILABLE()
  const level = p.hints[stepId] ?? 0
  if (level >= 3) return { run: null, outcome: { ok: true, repeat: true, hint: stepId } }
  return { run: withProgress(run, { ...p, hints: { ...p.hints, [stepId]: level + 1 } }, now), outcome: { ok: true, hint: stepId } }
}

/** Never final until a supported solution is accepted; a wrong theory leaves the run unchanged. */
function accuse(def: CaseDefinition, run: Run, suspect: string, slots: Record<string, string[]>, now: number): Result {
  const p = run.progress
  const a = def.accusation
  if (!meets(p, a.available) || !a.suspects.includes(suspect)) throw NOT_AVAILABLE()
  const attached = unique(Object.values(slots).flat())
  requireKnownFindings(p, attached)

  if (suspect !== a.culprit) {
    const objection = lastApplicable(p, a.objections[suspect] ?? []) ?? a.insufficient
    return { run: null, outcome: { ok: false, feedback: objection } }
  }
  const established = findingIds(p)
  for (const slot of a.slots) {
    if (includesAll(slots[slot.id] ?? [], slot.findings)) continue
    const why = includesAll(established, slot.findings) ? slot.attach : slot.missing
    return { run: null, outcome: { ok: false, feedback: `${a.insufficient} ${why}` } }
  }

  const findings = unique(a.slots.flatMap((s) => s.findings))
  const next: Run = {
    ...run,
    status: 'resolved',
    progress: { ...p, accusation: { suspect, findings } },
    updatedAt: now,
    resolvedAt: now,
  }
  return { run: next, outcome: { ok: true, resolved: true } }
}
