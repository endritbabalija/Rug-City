import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.FLAGS
process.env.DEV_AUTH = '1'

const { store, resetStore } = await import('@/lib/store')
const { resetFlagCache } = await import('@/lib/flags')
const runsRoute = await import('@/app/api/investigations/route')
const runRoute = await import('@/app/api/investigations/[runId]/route')
const actionsRoute = await import('@/app/api/investigations/[runId]/actions/route')
const meRoute = await import('@/app/api/me/route')

const ANA = 'dev 7:Ana'
const BEN = 'dev 8:Ben'

const settle = () => new Promise((r) => setTimeout(r, 0))

function req(path: string, auth: string | null, body?: unknown) {
  const headers: Record<string, string> = auth ? { authorization: auth } : {}
  return new Request(`http://test${path}`, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) })
}

const ctx = (runId: string) => ({ params: Promise.resolve({ runId }) })

async function start(auth: string | null = ANA, restart?: boolean) {
  return runsRoute.POST(req('/api/investigations', auth, { caseId: 'the-refund', restart }), undefined as never)
}
async function view(runId: string, auth: string | null = ANA) {
  return runRoute.GET(req(`/api/investigations/${runId}`, auth), ctx(runId))
}
async function act(runId: string, action: unknown, auth: string | null = ANA) {
  return actionsRoute.POST(req(`/api/investigations/${runId}/actions`, auth, action), ctx(runId))
}
async function json(res: Response | Promise<Response>) {
  const r = await res
  return { status: r.status, body: await r.json() }
}

async function opened(auth = ANA): Promise<string> {
  const { body } = await json(start(auth))
  await act(body.run.runId, { type: 'open_case' }, auth)
  return body.run.runId
}

/** Apply actions that must all succeed. */
async function play(runId: string, ...actions: unknown[]) {
  let last: { run: { status: string; evidence: { id: string }[]; findings: { id: string }[] } } | null = null
  for (const a of actions) {
    const { status, body } = await json(act(runId, a))
    expect(status, JSON.stringify(body)).toBe(200)
    expect(body.outcome.ok, JSON.stringify(a)).toBe(true)
    last = body
  }
  return last!
}

const F01 = { type: 'submit_finding', claim: 'F01', evidence: ['E01', 'E02'] }
const C01 = [F01, { type: 'open_topic', topic: 't-mika-mismatch' }, { type: 'confront', challenge: 'C01', evidence: ['E03'], findings: [] }]
const F02 = { type: 'submit_finding', claim: 'F02', evidence: ['E05', 'E02'] }
const F03 = [{ type: 'open_topic', topic: 't-mika-rd204' }, { type: 'submit_finding', claim: 'F03', evidence: ['E07', 'E06'] }]
const F04 = [
  { type: 'follow_lead', lead: 'lead-tx102' },
  { type: 'open_topic', topic: 't-cedar-cs88' },
  { type: 'submit_finding', claim: 'F04', evidence: ['E09', 'E08', 'E02'] },
]
const SOLUTION = { type: 'accuse', suspect: 'lena', slots: { diverted: ['F01'], approved: ['F02'], used: ['F03', 'F04'] }, activeMs: 420_000 }

beforeEach(() => {
  resetStore()
  resetFlagCache()
  process.env.FLAGS = 'refund_prototype'
})
afterEach(() => {
  delete process.env.FLAGS
  vi.restoreAllMocks()
})

describe('flag off', () => {
  it('Home sees the flag off and the server refuses starts and reads', async () => {
    delete process.env.FLAGS
    expect((await json(meRoute.GET(req('/api/me', ANA), undefined as never))).body.features).toEqual({ refund: false })
    expect((await start()).status).toBe(404)
    expect((await runsRoute.GET(req('/api/investigations?case=the-refund', ANA), undefined as never)).status).toBe(404)
    expect((await view('00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })
})

describe('starting and resuming', () => {
  it('opens on Lena’s message with no shop or credit requirement, then reaches the first comparison', async () => {
    const { status, body } = await json(start())
    expect(status).toBe(200)
    expect(body.run.status).toBe('intro')
    expect(body.run.intro.headline).toBe('12,000 LUM sent. No refunds received.')
    expect((await json(act(body.run.runId, F01))).body.error.code).toBe('NOT_OPEN')
    await act(body.run.runId, { type: 'open_case' })
    const first = await json(act(body.run.runId, F01))
    expect(first.body.run.findings.map((f: { id: string }) => f.id)).toEqual(['F01'])
  })

  it('resumes the latest run, and restart creates a separate one', async () => {
    const runId = await opened()
    await play(runId, ...C01)
    const resumed = await json(start())
    expect(resumed.body.run.runId).toBe(runId)
    expect(resumed.body.run.evidence.map((e: { id: string }) => e.id)).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'E06'])

    const restarted = await json(start(ANA, true))
    expect(restarted.body.run.runId).not.toBe(runId)
    expect(restarted.body.run.status).toBe('intro')
    expect(restarted.body.run.evidence).toHaveLength(2)
    // The old run is untouched.
    expect((await json(view(runId))).body.run.evidence).toHaveLength(6)
    expect((await json(runsRoute.GET(req('/api/investigations?case=the-refund', ANA), undefined as never))).body.run.runId).toBe(restarted.body.run.runId)
  })

  it('reloading after C01 and after F03 restores evidence, conversations and hints exactly', async () => {
    const runId = await opened()
    await play(runId, { type: 'request_hint', step: 'h-F01' }, ...C01, { type: 'request_hint', step: 'h-F02' }, { type: 'request_hint', step: 'h-F02' })
    const afterC01 = (await json(view(runId))).body.run
    expect(afterC01.people.find((p: { id: string }) => p.id === 'owen').transcript.map((t: { key: string }) => t.key)).toEqual(['C01'])
    expect(afterC01.hints.find((h: { id: string }) => h.id === 'h-F02').revealed).toHaveLength(2)
    const last = await play(runId, ...F03)
    expect((await json(view(runId))).body.run).toEqual(last.run)
  })
})

describe('access', () => {
  it('rejects other players and unauthenticated requests without revealing the run', async () => {
    const runId = await opened()
    const missing = await json(view('00000000-0000-4000-8000-000000000000', BEN))
    const other = await json(view(runId, BEN))
    expect(other).toEqual(missing)
    expect(other.status).toBe(404)
    expect((await json(act(runId, F01, BEN))).status).toBe(404)
    expect((await view(runId, null)).status).toBe(401)
    expect((await view('not-a-uuid')).status).toBe(404)
    expect((await json(view(runId))).body.run.findings).toEqual([])
  })

  it('guessed ids cannot unlock progress or leak content', async () => {
    const runId = await opened()
    const tries = [
      { type: 'submit_finding', claim: 'F03', evidence: ['E06', 'E07'] },
      { type: 'submit_finding', claim: 'F01', evidence: ['E01', 'E05'] },
      { type: 'open_topic', topic: 't-cedar-cs88' },
      { type: 'confront', challenge: 'C02', evidence: [], findings: ['F02'] },
      { type: 'follow_lead', lead: 'lead-tx102' },
      { type: 'request_hint', step: 'h-F04' },
      { type: 'evidence_opened', evidence: 'E07' },
    ]
    for (const t of tries) {
      const { status, body } = await json(act(runId, t))
      expect(status, JSON.stringify(t)).toBe(400)
      expect(JSON.stringify(body)).not.toMatch(/Lena|RD-204|Cedar|approval|account/i)
    }
    expect((await json(view(runId))).body.run.evidence).toHaveLength(2)
  })

  it('validates bodies and limits their size', async () => {
    const runId = await opened()
    expect((await act(runId, { type: 'submit_finding', claim: 'F01', evidence: [] })).status).toBe(400)
    expect((await act(runId, { type: 'teleport' })).status).toBe(400)
    expect((await act(runId, { type: 'open_topic', topic: 'x'.repeat(5000) })).status).toBe(413)
  })
})

describe('consistency', () => {
  it('repeats, reversed order and two tabs at once leave one copy of everything', async () => {
    const runId = await opened()
    const results = await Promise.all([act(runId, F01), act(runId, { ...F01, evidence: ['E02', 'E01', 'E01'] }), act(runId, F01)])
    for (const r of results) expect(r.status).toBe(200)
    await play(runId, { type: 'open_topic', topic: 't-mika-mismatch' })
    await Promise.all([1, 2, 3].map(() => act(runId, C01[2])))
    const run = (await json(view(runId))).body.run
    expect(run.findings).toHaveLength(1)
    expect(run.evidence.map((e: { id: string }) => e.id)).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'E06'])
    expect(run.people.find((p: { id: string }) => p.id === 'owen').transcript).toHaveLength(1)
  })

  it('completes the full case with scripted actions only, idempotently', async () => {
    const track = vi.spyOn(store(), 'trackEvents')
    const runId = await opened()
    const done = await play(runId, ...C01, F02, ...F03, ...F04, SOLUTION)
    expect(done.run.status).toBe('resolved')
    const again = await json(act(runId, SOLUTION))
    expect(again.body.outcome).toMatchObject({ ok: true, repeat: true })
    await settle()
    const names = track.mock.calls.flatMap(([events]) => events.map((e) => e.name))
    expect(names.filter((n) => n === 'investigation_completed')).toHaveLength(1)
    expect(names).toEqual(expect.arrayContaining(['investigation_started', 'finding_established', 'confrontation_resolved', 'accusation_submitted']))
    // Analytics never carries dialogue or document text.
    expect(JSON.stringify(track.mock.calls)).not.toMatch(/COMMUNITY-04|Owen must|personal settlement/)
  })
})
