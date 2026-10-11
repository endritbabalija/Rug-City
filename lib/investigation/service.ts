import 'server-only'
import { track } from '../analytics'
import { AppError } from '../errors'
import { flag } from '../flags'
import { store } from '../store'
import { getCase } from './cases'
import { applyAction, newProgress, type Outcome } from './rules'
import type { Action, Run } from './types'
import { project, projectOutcome, type OutcomeView, type RunView } from './view'

// Load a run, check access, apply the pure rules, save with compare-and-swap, track.

const NOT_FOUND = () => new AppError('NOT_FOUND', 'Case file not found.', 404)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Server-side gate for every investigation endpoint. */
export async function requireRefund() {
  if (!(await flag('refund_prototype'))) throw new AppError('NOT_AVAILABLE', 'This case isn’t open yet.', 404)
}

/** Who may see and act on a run. With co-op this becomes room membership. */
export const canAccess = (run: Run, playerId: number) => run.ownerId === playerId

async function loadRun(playerId: number, runId: string): Promise<Run> {
  if (!UUID.test(runId)) throw NOT_FOUND()
  const run = await store().getRun(runId)
  // Someone else's run looks exactly like a missing one.
  if (!run || !canAccess(run, playerId)) throw NOT_FOUND()
  return run
}

const props = (run: Run) => ({ runId: run.id, caseId: run.caseId, caseVersion: run.caseVersion })

export async function latestRun(playerId: number, caseId: string) {
  getCase(caseId)
  const run = await store().getLatestRun(playerId, caseId)
  return run ? { runId: run.id, status: run.status } : null
}

/** Resume the player's latest run of the case, or start one. `restart` always starts a new, separate run. */
export async function startRun(playerId: number, caseId: string, restart: boolean): Promise<RunView> {
  const def = getCase(caseId)
  if (!restart) {
    const existing = await store().getLatestRun(playerId, caseId)
    if (existing) {
      track('investigation_resumed', playerId, { ...props(existing), status: existing.status })
      return project(getCase(existing.caseId, existing.caseVersion), existing)
    }
  }
  const now = Date.now()
  const run = await store().createRun({
    id: crypto.randomUUID(),
    ownerId: playerId,
    caseId: def.id,
    caseVersion: def.version,
    status: 'intro',
    progress: newProgress(def),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  })
  track('investigation_started', playerId, { ...props(run), restart })
  return project(def, run)
}

export async function getRunView(playerId: number, runId: string): Promise<RunView> {
  const run = await loadRun(playerId, runId)
  return project(getCase(run.caseId, run.caseVersion), run)
}

export async function act(playerId: number, runId: string, action: Action): Promise<{ run: RunView; outcome: OutcomeView }> {
  const loaded = await loadRun(playerId, runId)
  const def = getCase(loaded.caseId, loaded.caseVersion)

  let outcome: Outcome = { ok: true }
  const stored = await store().updateRun(runId, (current) => {
    const result = applyAction(def, current, action, Date.now())
    outcome = result.outcome
    return result.run
  })

  trackAction(playerId, stored, action, outcome)
  return { run: project(def, stored), outcome: projectOutcome(def, outcome) }
}

function trackAction(playerId: number, run: Run, action: Action, o: Outcome) {
  const base = props(run)
  switch (action.type) {
    case 'evidence_opened':
      track('evidence_opened', playerId, { ...base, evidence: action.evidence })
      return
    case 'submit_finding':
      track('finding_attempted', playerId, { ...base, claim: action.claim, evidence: [...action.evidence].sort(), ok: o.ok })
      if (o.finding && !o.repeat) track('finding_established', playerId, { ...base, finding: o.finding })
      return
    case 'confront':
      track('confrontation_attempted', playerId, { ...base, challenge: action.challenge, ok: o.ok })
      if (o.ok && !o.repeat) track('confrontation_resolved', playerId, { ...base, confrontation: action.challenge })
      return
    case 'request_hint':
      track('hint_requested', playerId, { ...base, step: action.step, level: run.progress.hints[action.step] ?? 0 })
      return
    case 'accuse':
      if (o.repeat) return
      track('accusation_submitted', playerId, { ...base, suspect: action.suspect, ok: o.ok })
      // Fires once: only the request that moved the run to resolved gets here.
      if (o.resolved && run.resolvedAt)
        track('investigation_completed', playerId, {
          ...base,
          activeMs: action.activeMs ?? null,
          wallMs: run.resolvedAt - run.createdAt,
          hints: Object.values(run.progress.hints).reduce((a, b) => a + b, 0),
          confrontations: run.progress.confrontations,
        })
      return
  }
}
