import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/errors'
import { allCases } from '@/lib/investigation/cases'
import { THE_REFUND_V1 as def } from '@/lib/investigation/cases/refund'
import { applyAction, findingIds, newProgress, type Outcome } from '@/lib/investigation/rules'
import type { Action, CaseDefinition, Run } from '@/lib/investigation/types'
import { project } from '@/lib/investigation/view'

const T0 = 1_000

function fresh(d: CaseDefinition = def, status: Run['status'] = 'investigating'): Run {
  return { id: 'run-1', ownerId: 1, caseId: d.id, caseVersion: d.version, status, progress: newProgress(d), createdAt: T0, updatedAt: T0, resolvedAt: null }
}

/** Apply an action, returning the next run (unchanged if the rules changed nothing) and the outcome. */
function step(run: Run, action: Action, d: CaseDefinition = def): [Run, Outcome] {
  const { run: next, outcome } = applyAction(d, run, action, T0 + 1)
  return [next ?? run, outcome]
}

/** Apply actions that must all succeed. */
function play(run: Run, ...actions: Action[]): Run {
  for (const a of actions) {
    const [next, outcome] = step(run, a)
    expect(outcome, JSON.stringify(a)).toMatchObject({ ok: true })
    run = next
  }
  return run
}

function rejects(run: Run, action: Action, code: string) {
  try {
    applyAction(def, run, action, T0)
  } catch (e) {
    expect(e).toBeInstanceOf(AppError)
    expect((e as AppError).code).toBe(code)
    return e as AppError
  }
  throw new Error(`expected ${code}`)
}

const finding = (claim: string, ...evidence: string[]): Action => ({ type: 'submit_finding', claim, evidence })
const topic = (t: string): Action => ({ type: 'open_topic', topic: t })
const confront = (challenge: string, evidence: string[] = [], findings: string[] = []): Action => ({ type: 'confront', challenge, evidence, findings })
const SOLUTION: Action = { type: 'accuse', suspect: 'lena', slots: { diverted: ['F01'], approved: ['F02'], used: ['F03', 'F04'] } }

// Shared prefixes of the brief's paths (§10).
const F01 = finding('F01', 'E01', 'E02')
const C01 = [F01, topic('t-mika-mismatch'), confront('C01', ['E03'])]
const F02 = finding('F02', 'E05', 'E02')
const F03 = [topic('t-mika-rd204'), finding('F03', 'E06', 'E07')]
const F04 = [{ type: 'follow_lead', lead: 'lead-tx102' } as Action, topic('t-cedar-cs88'), finding('F04', 'E02', 'E08', 'E09')]

describe('findings', () => {
  it('ignore evidence order and duplicates, and keep only the supporting subset', () => {
    const run = play(fresh(), finding('F01', 'E02', 'E01', 'E02'))
    expect(run.progress.findings).toEqual([{ id: 'F01', support: ['E01', 'E02'] }])
  })

  it('accept a valid subset plus irrelevant known evidence', () => {
    const run = play(fresh(), ...C01, finding('F02', 'E03', 'E02', 'E01', 'E05'))
    expect(run.progress.findings.at(-1)).toEqual({ id: 'F02', support: ['E05', 'E02'] })
  })

  it('accept repeats idempotently', () => {
    const run = play(fresh(), F01)
    const [again, outcome] = step(run, F01)
    expect(outcome).toMatchObject({ ok: true, repeat: true, finding: 'F01' })
    expect(again).toBe(run)
  })

  it('give specific feedback for an insufficient set without changing the run', () => {
    const run = fresh()
    const [next, outcome] = step(run, finding('F01', 'E02'))
    expect(outcome).toEqual({ ok: false, feedback: 'That’s what was sent. Compare it with what was promised.' })
    expect(next).toBe(run)
  })

  it('give the brief’s feedback on plausible wrong inferences', () => {
    let run = fresh()
    expect(step(run, finding('X-owen-owns', 'E02'))[1].feedback).toBe('This shows who submitted the payment, not who owns its destination.')
    run = play(run, ...C01)
    expect(step(run, finding('X-owen-stole', 'E03'))[1].feedback).toBe(
      'This contradicts his claim about going offline. It does not establish who chose or owns the destination.',
    )
    run = play(run, ...F04.slice(0, 2))
    expect(step(run, finding('F04', 'E05'))[1].feedback).toBe('This records her approval, not what the receiving account did next.')
    expect(step(run, finding('X-owen-owns', 'E01'))[1].feedback).toBe('These records do not establish that claim yet.')
  })

  it('accept either supporting set for F03', () => {
    const viaLedger = play(fresh(), ...C01, ...F04, topic('t-mika-rd204'), finding('F03', 'E08', 'E07'))
    expect(viaLedger.progress.findings.at(-1)).toEqual({ id: 'F03', support: ['E08', 'E07'] })
  })

  it('reject unknown or undiscovered evidence without naming it', () => {
    const err = rejects(fresh(), finding('F01', 'E01', 'E05'), 'UNKNOWN_EVIDENCE')
    expect(err.message).not.toMatch(/approval|receipt/i)
    rejects(fresh(), finding('F01', 'E01', 'NOPE'), 'UNKNOWN_EVIDENCE')
  })

  it('reject claims that are not yet visible, the same way as unknown ones', () => {
    const locked = rejects(fresh(), finding('F02', 'E01', 'E02'), 'NOT_AVAILABLE')
    const unknown = rejects(fresh(), finding('F99', 'E01', 'E02'), 'NOT_AVAILABLE')
    expect(locked.message).toBe(unknown.message)
  })
})

describe('conversations and confrontations', () => {
  it('gate topics on findings and unlock records once', () => {
    rejects(fresh(), topic('t-mika-mismatch'), 'NOT_AVAILABLE')
    const run = play(fresh(), F01, topic('t-mika-mismatch'))
    expect(run.progress.evidence).toContain('E03')
    const [again, outcome] = step(run, topic('t-mika-mismatch'))
    expect(outcome).toMatchObject({ ok: true, repeat: true })
    expect(again.progress.transcript).toHaveLength(1)
  })

  it('need the warning to break Owen’s statement, and unlock his records together', () => {
    let run = play(fresh(), F01)
    expect(step(run, confront('C01', ['E02']))[1]).toMatchObject({ ok: false })
    rejects(run, confront('C01', ['E03']), 'UNKNOWN_EVIDENCE')
    run = play(run, topic('t-mika-mismatch'))
    const [next, outcome] = step(run, confront('C01', ['E03']))
    expect(outcome.evidence).toEqual(['E04', 'E05', 'E06'])
    const [repeat, again] = step(next, confront('C01', ['E03']))
    expect(again).toMatchObject({ ok: true, repeat: true })
    expect(repeat.progress.transcript.filter((t) => t.key === 'C01')).toHaveLength(1)
  })

  it('reject a challenge whose claim is not visible yet', () => {
    rejects(fresh(), confront('C01', ['E02']), 'NOT_AVAILABLE')
    rejects(play(fresh(), ...C01, F02), confront('C03', [], ['F02']), 'NOT_AVAILABLE')
  })

  it('require Lena’s challenges to cite established findings', () => {
    let run = play(fresh(), ...C01)
    expect(step(run, confront('C02', ['E05']))[1]).toMatchObject({ ok: false })
    rejects(run, confront('C02', [], ['F02']), 'UNKNOWN_FINDING')
    run = play(run, F02, confront('C02', [], ['F02']))
    expect(project(def, run).people.find((p) => p.id === 'lena')!.statements.map((s) => [s.id, s.changed])).toEqual([
      ['S-L1', true],
      ['S-L2', false],
    ])
  })
})

describe('hints', () => {
  it('reveal one level per request, up to three, and stay free', () => {
    let run = fresh()
    for (let i = 0; i < 4; i++) run = play(run, { type: 'request_hint', step: 'h-F01' })
    expect(run.progress.hints['h-F01']).toBe(3)
    expect(project(def, run).hints[0].revealed).toHaveLength(3)
    expect(run.progress.evidence).toEqual(def.initialEvidence)
  })

  it('stay unavailable until their prerequisites hold', () => {
    rejects(fresh(), { type: 'request_hint', step: 'h-F02' }, 'NOT_AVAILABLE')
    rejects(fresh(), { type: 'request_hint', step: 'h-F04' }, 'NOT_AVAILABLE')
  })
})

describe('accusation', () => {
  it('is available once F01 exists and never final on a wrong theory', () => {
    rejects(fresh(), SOLUTION, 'NOT_AVAILABLE')
    const run = play(fresh(), F01)
    const [owen, objection] = step(run, { type: 'accuse', suspect: 'owen', slots: { diverted: ['F01'] } })
    expect(objection.ok).toBe(false)
    expect(objection.feedback).toMatch(/doesn’t show who chose or owns RELAY-72/)
    expect(owen).toBe(run)
    const [, weak] = step(run, { type: 'accuse', suspect: 'lena', slots: { diverted: ['F01'] } })
    expect(weak.feedback).toBe('Your theory needs more support. You haven’t established who approved the changed destination.')
  })

  it('asks to attach an established finding before claiming it is missing', () => {
    const run = play(fresh(), ...C01, F02)
    expect(step(run, { type: 'accuse', suspect: 'lena', slots: { diverted: ['F01'] } })[1].feedback).toBe(
      'Your theory needs more support. Attach your finding about who approved the destination.',
    )
  })

  it('rejects findings the player has not established', () => {
    rejects(play(fresh(), F01), SOLUTION, 'UNKNOWN_FINDING')
  })
})

describe('the brief’s alternate paths (§10)', () => {
  it('path 4: F03 and F04 before challenging Lena about the approval', () => {
    const run = play(fresh(), ...C01, ...F03, ...F04, F02, confront('C02', [], ['F02']), SOLUTION)
    expect(run.status).toBe('resolved')
  })

  it('path 5: F02 first, then F04, then F03', () => {
    const run = play(fresh(), ...C01, F02, ...F04, ...F03, SOLUTION)
    expect(run.status).toBe('resolved')
    expect(findingIds(run.progress)).toEqual(['F01', 'F02', 'F04', 'F03'])
  })

  it('path 6: without C02/C03 the ending does not claim a confession', () => {
    const run = play(fresh(), ...C01, F02, ...F03, ...F04, SOLUTION)
    const text = project(def, run).ending!.paragraphs.join(' ')
    expect(text).toContain('Lena never admitted taking the money.')
    expect(text).not.toMatch(/holding account|wouldn’t wait/)
  })

  it('with C02 and C03 the ending reflects what Lena actually said', () => {
    const run = play(fresh(), ...C01, F02, confront('C02', [], ['F02']), ...F03, ...F04, confront('C03', [], ['F03', 'F04']), SOLUTION)
    const text = project(def, run).ending!.paragraphs.join(' ')
    expect(text).toMatch(/holding account/)
    expect(text).toMatch(/wouldn’t wait/)
    expect(text).not.toContain('never admitted')
  })

  it('path 9: early wrong accusations keep progress, and one record supports several findings', () => {
    let run = play(fresh(), ...C01)
    const before = run
    run = step(run, { type: 'accuse', suspect: 'mika', slots: { diverted: ['F01'] } })[0]
    expect(run).toBe(before)
    run = play(run, F02, ...F04, ...F03, SOLUTION)
    expect(run.progress.findings.filter((f) => f.support.includes('E02')).map((f) => f.id)).toEqual(['F01', 'F02', 'F04'])
  })

  it('a resolved run accepts a retried accusation and refuses new actions', () => {
    const run = play(fresh(), ...C01, F02, ...F03, ...F04, SOLUTION)
    expect(step(run, SOLUTION)[1]).toMatchObject({ ok: true, repeat: true, resolved: true })
    rejects(run, topic('t-lena-approval'), 'CLOSED')
  })

  it('an intro run must be opened first', () => {
    rejects(fresh(def, 'intro'), F01, 'NOT_OPEN')
    expect(step(fresh(def, 'intro'), { type: 'open_case' })[0].status).toBe('investigating')
  })
})

describe('projection', () => {
  const HIDDEN = ['RD-204', 'CS-88', 'CEDAR', 'Cedar', 'PAY-17', 'Approver', 'Account holder', 'personal', 'creditor', 'Day −1', 'E05', 'E07', 'E09']

  it('withholds hidden records, owners, creditor details and answers at the start', () => {
    const json = JSON.stringify(project(def, fresh(def, 'intro')))
    for (const s of HIDDEN) expect(json, s).not.toContain(s)
    expect(json).not.toContain('"support"')
  })

  it('withholds ownership and creditor records after C01', () => {
    const json = JSON.stringify(project(def, play(fresh(), ...C01)))
    for (const s of ['CS-88', 'Account holder', 'Cedar Studio', 'Day −1', 'creditor', 'prior obligation', 'E07', 'E08', 'E09']) expect(json, s).not.toContain(s)
  })

  it('offers the timeline only while F02 is missing', () => {
    let run = play(fresh(), ...C01)
    expect(project(def, run).timeline?.items.map((i) => i.evidence)).toEqual(['E05', 'E02', 'E03'])
    run = play(run, F02)
    expect(project(def, run).timeline).toBeNull()
  })
})

describe.each(allCases().map((d) => [`${d.id} v${d.version}`, d] as const))('content: %s', (_, d) => {
  const evidenceIds = new Set(d.evidence.map((e) => e.id))
  const claimIds = new Set(d.claims.filter((c) => c.support).map((c) => c.id))
  const confrontationIds = new Set(d.challenges.filter((c) => c.confrontation).map((c) => c.id))

  it('refers only to things that exist', () => {
    const reqs = [
      ...d.people.map((p) => p.available),
      ...d.statements.map((s) => s.visible),
      ...d.topics.map((t) => t.requires),
      ...d.claims.map((c) => c.visible),
      ...d.challenges.map((c) => c.visible),
      ...d.hints.flatMap((h) => [h.available, h.done]),
      ...[...d.questions, ...d.dex, ...d.ending.reconstruction, ...Object.values(d.accusation.objections).flat()].flatMap((l) => [l.requires, l.unless ?? {}]),
    ]
    for (const r of reqs) {
      for (const id of r.evidence ?? []) expect(evidenceIds.has(id), id).toBe(true)
      for (const id of r.findings ?? []) expect(claimIds.has(id), id).toBe(true)
      for (const id of r.confrontations ?? []) expect(confrontationIds.has(id), id).toBe(true)
    }
    const lines = [...d.people.flatMap((p) => p.opening), ...d.topics.flatMap((t) => t.lines), ...d.challenges.flatMap((c) => c.confrontation?.lines ?? [])]
    for (const id of lines) expect(d.lines[id], id).toBeDefined()
    const records = [
      ...d.initialEvidence,
      ...d.topics.flatMap((t) => t.unlocks ?? []),
      ...d.leads.flatMap((l) => [l.evidence, ...l.unlocks]),
      ...d.claims.flatMap((c) => [...(c.support ?? []).flat(), ...c.feedback.flatMap((f) => f.when)]),
      ...d.challenges.flatMap((c) => [...(c.confrontation?.evidence ?? []), ...(c.confrontation?.unlocks ?? [])]),
    ]
    for (const id of records) expect(evidenceIds.has(id), id).toBe(true)
    for (const s of d.accusation.slots) for (const id of s.findings) expect(claimIds.has(id), id).toBe(true)
  })

  it('makes every record, finding and confrontation reachable, and the case solvable', () => {
    // Keep trying every action the content defines until nothing changes.
    let run = fresh(d)
    const candidates: Action[] = [
      ...d.topics.map((t) => topic(t.id)),
      ...d.leads.map((l) => ({ type: 'follow_lead', lead: l.id }) as Action),
      ...d.claims.flatMap((c) => (c.support ?? []).map((set) => finding(c.id, ...set))),
      ...d.challenges.flatMap((c) => (c.confrontation ? [confront(c.id, c.confrontation.evidence, c.confrontation.findings)] : [])),
    ]
    for (let changed = true; changed; ) {
      changed = false
      for (const a of candidates) {
        try {
          const next = applyAction(d, run, a, T0).run
          if (next) {
            run = next
            changed = true
          }
        } catch (e) {
          if (!(e instanceof AppError)) throw e
        }
      }
    }
    expect(new Set(run.progress.evidence)).toEqual(evidenceIds)
    expect(new Set(findingIds(run.progress))).toEqual(claimIds)
    expect(new Set(run.progress.confrontations)).toEqual(confrontationIds)

    const slots = Object.fromEntries(d.accusation.slots.map((s) => [s.id, s.findings]))
    const solved = applyAction(d, run, { type: 'accuse', suspect: d.accusation.culprit, slots }, T0)
    expect(solved.run?.status).toBe('resolved')
  })

  it('never gates a supporting record on the finding it supports', () => {
    for (const c of d.claims.filter((x) => x.support)) {
      for (const set of c.support!) {
        for (const id of set) {
          const gatedOnSelf = d.topics.some((t) => t.unlocks?.includes(id) && t.requires.findings?.includes(c.id))
          expect(gatedOnSelf, `${c.id} needs ${id}`).toBe(false)
        }
      }
    }
  })
})
