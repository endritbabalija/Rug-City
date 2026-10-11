'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { StoredCaseDetail, StoredCaseSummary } from '@/lib/cases/admin'
import type { SolverRun } from '@/lib/cases/checks'
import { api, ApiError } from '@/lib/client/api'
import { ClueCard } from '../evidence/ClueCard'
import { useGame } from '../GameContext'
import { Button, Label, Pill, Tape } from '../ui'

// Admin-only case review (docs/phase-1/06-case-pipeline.md): read a drafted case and its
// solver report, playtest it for free, then approve it with a release time or reject it.

const STATUSES = ['review', 'live', 'retired'] as const
type Status = (typeof STATUSES)[number]

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')

export function CaseReviewList() {
  const { go } = useGame()
  const [status, setStatus] = useState<Status>('review')
  const [cases, setCases] = useState<StoredCaseSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api<{ cases: StoredCaseSummary[] }>(`/api/admin/cases?status=${status}`)
      .then((r) => live && (setCases(r.cases), setError(null)))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : 'Could not load cases.'))
    return () => {
      live = false
    }
  }, [status])

  return (
    <div className="pb-12">
      <Tape>Evidence room · staff only</Tape>
      <header className="px-5 pt-6">
        <button onClick={() => go({ name: 'home' })} className="font-mono text-xs text-dim">
          ‹ Home
        </button>
        <h1 className="mt-2 font-display text-5xl leading-none font-black uppercase">Case review</h1>
      </header>
      <nav className="mx-5 mt-4 flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => (setCases(null), setStatus(s))}
            className={`rounded-full border px-3 py-1 font-mono text-xs uppercase ${s === status ? 'border-tape text-tape' : 'border-line text-dim'}`}
          >
            {s}
          </button>
        ))}
      </nav>
      <section className="mt-4 space-y-2 px-5">
        {error && <p className="text-sm text-rug">{error}</p>}
        {!cases && !error && <p className="font-mono text-xs text-dim">Loading…</p>}
        {cases?.length === 0 && <p className="text-sm text-dim">No {status} cases.</p>}
        {cases?.map((c) => (
          <button key={c.id} onClick={() => go({ name: 'adminCase', id: c.id })} className="block w-full rounded-md border border-line bg-ink-2 px-4 py-3 text-left">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-xl font-bold uppercase">{c.title}</span>
              {c.passed !== null && <Pill tone={c.passed ? 'ok' : 'rug'}>{c.passed ? 'Solver passed' : 'Solver failed'}</Pill>}
            </div>
            <p className="mt-1 text-sm text-paper/70">{c.crime}</p>
            <p className="mt-1 font-mono text-[11px] text-dim">
              {c.id} · v{c.version}
              {c.targetSec ? ` · ${Math.round(c.targetSec / 60)} min` : ''}
              {c.needsInterrogation.length ? ` · needs interrogation: ${c.needsInterrogation.join(', ')}` : ''}
              {status === 'live' ? ` · release ${when(c.releaseAt)}` : ''}
            </p>
          </button>
        ))}
      </section>
    </div>
  )
}

/** `datetime-local` value for a time, in the browser's zone. */
function localInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

export function CaseReview({ id }: { id: string }) {
  const { go, toast } = useGame()
  const [detail, setDetail] = useState<StoredCaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [releaseAt, setReleaseAt] = useState(() => localInput(Date.now() + 86_400_000))
  const [targetMin, setTargetMin] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await api<{ case: StoredCaseDetail }>(`/api/admin/cases/${encodeURIComponent(id)}`)
      setDetail(r.case)
      setTargetMin(String(Math.round((r.case.data.targetSec ?? r.case.data.review?.suggestedTargetSec ?? 900) / 60)))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the case.')
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once per case
    void load()
  }, [load])

  async function post(action: string, body: Record<string, unknown> = {}) {
    setBusy(action)
    try {
      return await api<{ case?: StoredCaseDetail; code?: string }>(`/api/admin/cases/${encodeURIComponent(id)}`, { action, ...body })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That did not work.', 'error')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function playtest() {
    const r = await post('playtest')
    if (r?.code) go({ name: 'room', code: r.code })
  }

  async function approve() {
    const at = new Date(releaseAt).getTime()
    const minutes = Number(targetMin)
    if (!Number.isFinite(at) || !(minutes >= 1)) return toast('Set a release time and a target in minutes.', 'error')
    const r = await post('approve', { releaseAt: at, targetSec: Math.round(minutes * 60) })
    if (r?.case) {
      setDetail(r.case)
      toast(`Live from ${when(at)}.`, 'ok')
    }
  }

  async function reject() {
    const r = await post('reject', { reason: reason.trim() || undefined })
    if (r?.case) {
      setDetail(r.case)
      toast('Case retired.', 'ok')
    }
  }

  if (error || !detail) {
    return (
      <div className="px-5 pt-8">
        <button onClick={() => go({ name: 'admin' })} className="font-mono text-xs text-dim">
          ‹ Case review
        </button>
        <p className={`mt-4 text-sm ${error ? 'text-rug' : 'font-mono text-dim'}`}>{error ?? 'Loading…'}</p>
      </div>
    )
  }

  const c = detail.data
  const review = c.review
  const suspect = (sid: string) => c.suspects.find((s) => s.id === sid)?.name ?? sid

  return (
    <div className="pb-16">
      <Tape>{detail.status === 'review' ? 'Awaiting review' : detail.status}</Tape>
      <header className="px-5 pt-6">
        <button onClick={() => go({ name: 'admin' })} className="font-mono text-xs text-dim">
          ‹ Case review
        </button>
        <p className="mt-3 font-mono text-xs text-dim">
          {detail.id} · {detail.district} · v{detail.version}
          {detail.releaseAt ? ` · release ${when(detail.releaseAt)}` : ''}
        </p>
        <h1 className="mt-1 font-display text-4xl leading-[0.95] font-black uppercase">{c.title}</h1>
        <p className="mt-1 font-type text-sm font-bold text-rug uppercase">{c.crime}</p>
        <p className="mt-2 text-[15px] text-paper/85">{c.tagline}</p>
      </header>

      <section className="mx-5 mt-5 space-y-3 rounded-md border border-tape/40 bg-ink-2 p-4">
        <Button className="w-full" busy={busy === 'playtest'} onClick={playtest}>
          🕵️ Playtest solo (free, unrated)
        </Button>
        {detail.status === 'review' && (
          <>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <label className="text-xs text-dim">
                Release
                <input
                  type="datetime-local"
                  value={releaseAt}
                  onChange={(e) => setReleaseAt(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-md border border-line bg-ink px-2 text-paper"
                />
              </label>
              <label className="text-xs text-dim">
                Target (min)
                <input
                  type="number"
                  min={1}
                  value={targetMin}
                  onChange={(e) => setTargetMin(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-md border border-line bg-ink px-2 text-paper"
                />
              </label>
            </div>
            <Button variant="ghost" className="w-full" busy={busy === 'approve'} onClick={approve}>
              Approve
            </Button>
          </>
        )}
        {detail.status !== 'retired' && (
          <div className="flex gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="min-h-12 w-full rounded-md border border-line bg-ink px-3 text-sm text-paper placeholder:text-dim"
            />
            <Button variant="danger" busy={busy === 'reject'} onClick={reject}>
              {detail.status === 'live' ? 'Retire' : 'Reject'}
            </Button>
          </div>
        )}
        {review?.rejected && <p className="text-xs text-rug">Rejected {when(review.rejected.at)}{review.rejected.reason ? `: ${review.rejected.reason}` : ''}</p>}
      </section>

      {review && (
        <Block title="Solver report">
          <p className="text-sm">
            <Pill tone={review.passed ? 'ok' : 'rug'}>{review.passed ? 'Passed' : 'Failed'}</Pill>{' '}
            <span className="text-paper/80">
              Suggested target {Math.round(review.suggestedTargetSec / 60)} min. Needs interrogation:{' '}
              <b>{review.needsInterrogation.length ? review.needsInterrogation.join(', ') : 'nothing (warning)'}</b>.
            </span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-dim">
            {review.draftModel ? `drafted by ${review.draftModel} · ` : ''}solved by {review.solverModel} · {when(review.checkedAt)}
            {review.crime ? ` · asked for: ${review.crime}` : ''}
          </p>
          {review.failures.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-rug">
              {review.failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <Runs title="Public info only (must not guess it)" runs={review.publicOnly ?? []} suspect={suspect} />
          <Runs title="All clues + interrogation (must get 3/3)" runs={review.full} suspect={suspect} />
          <Runs title="All clues, no chats (must miss one)" runs={review.noChats} suspect={suspect} />
          <Runs title="Single hands (must not name the culprit confidently)" runs={review.hands} suspect={suspect} />
        </Block>
      )}

      <Block title="Answer">
        <p className="text-sm">
          <b>{suspect(c.answer.culprit)}</b> · {c.motives.find((m) => m.id === c.answer.motive)?.text} · {c.trails.find((t) => t.id === c.answer.trail)?.text}
        </p>
        <p className="mt-2 font-mono text-[11px] text-dim">
          Proofs: {c.culpritProofs.map((p) => p.join('+')).join(' · ')} · deal order: {c.dealOrder.join(' ')}
        </p>
      </Block>

      <Block title={`${c.project.name} ${c.project.ticker}`}>
        <p className="text-sm text-paper/80">{c.project.pitch}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {c.briefing.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 font-mono text-xs text-paper/80">
          {c.timeline.map((t) => (
            <li key={t.at + t.text}>
              <span className="text-dim">{t.at}</span> {t.text}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Suspects">
        <div className="space-y-4">
          {c.suspects.map((s) => (
            <div key={s.id} className="text-sm">
              <p className="font-display text-lg font-bold uppercase">
                {s.avatar} {s.name} <span className="font-mono text-xs text-dim normal-case">{s.handle} · {s.archetype}</span>
                {s.id === c.answer.culprit && <span className="ml-2 text-rug">culprit</span>}
              </p>
              <p className="text-paper/80">{s.blurb}</p>
              <p className="mt-1">
                <span className="text-dim">Opener:</span> {s.opener}
              </p>
              <p className="mt-1">
                <span className="text-dim">Truth:</span> {s.truth}
              </p>
              {s.lies.length > 0 && (
                <p className="mt-1">
                  <span className="text-dim">Lies:</span> {s.lies.join(' / ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </Block>

      <section className="mt-6 space-y-4 px-5">
        <Label>Clues</Label>
        {c.clues.map((clue, i) => (
          <div key={clue.id}>
            <p className="mb-1 font-mono text-[11px] text-dim">{clue.id}</p>
            <ClueCard clue={clue} index={i} />
          </div>
        ))}
      </section>

      <Block title="Explorer">
        <ul className="space-y-1 font-mono text-[11px] text-paper/80">
          {c.wallets.map((w) => (
            <li key={w.id}>
              {w.id} · {w.label} · {w.address} · funded by {w.fundedBy}
              {w.fundingHidden ? ' (hidden until traced)' : ''}
              {w.note ? ` · ${w.note}` : ''}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-paper/80">
          {c.txs.map((t) => (
            <li key={t.id}>
              {t.at} · {t.from} → {t.to} · {t.amount} {t.token}
              {t.memo ? ` · ${t.memo}` : ''}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Hints and reveal">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {c.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
        <ul className="mt-3 space-y-1 text-sm text-paper/80">
          {c.reveal.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-5 mt-6">
      <Label>{title}</Label>
      <div className="mt-2 rounded-md border border-line bg-ink-2 p-4">{children}</div>
    </section>
  )
}

function Runs({ title, runs, suspect }: { title: string; runs: SolverRun[]; suspect: (id: string) => string }) {
  if (!runs.length) return null
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {title} · {runs.filter((r) => r.pass).length}/{runs.length} passed
      </summary>
      <ul className="mt-2 space-y-2">
        {runs.map((r, i) => (
          <li key={i} className={`border-l-2 pl-3 text-xs ${r.pass ? 'border-ok' : 'border-rug'}`}>
            <p className="font-mono">
              {r.label}: {suspect(r.culprit)} {r.correct.culprit ? '✓' : '✗'} · {r.motive} {r.correct.motive ? '✓' : '✗'} · {r.trail} {r.correct.trail ? '✓' : '✗'} · {r.confidence}
            </p>
            <p className="mt-0.5 text-paper/70">{r.reasoning}</p>
          </li>
        ))}
      </ul>
    </details>
  )
}
