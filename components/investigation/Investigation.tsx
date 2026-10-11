'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
import type { Action } from '@/lib/investigation/types'
import type { OutcomeView, RunView } from '@/lib/investigation/view'
import { bindBackButton, haptic } from '@/lib/telegram/webapp'
import { Label } from '../ui'
import { Accusation } from './Accusation'
import { CaseDesk } from './CaseDesk'
import { Compare } from './Compare'
import { EvidenceList, EvidenceSheet } from './Evidence'
import { Hints } from './Hints'
import { PeopleList, PersonDetail } from './People'
import { Ending, Intro } from './Story'
import { Timeline } from './Timeline'

type Tab = 'desk' | 'people' | 'evidence'
type Panel = 'timeline' | 'hints' | 'accuse' | null

const TABS: { id: Tab; label: string }[] = [
  { id: 'desk', label: 'Case desk' },
  { id: 'people', label: 'People' },
  { id: 'evidence', label: 'Evidence' },
]

// Personal conveniences, kept per run in this browser only. Never needed to progress.
function readList(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}
function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // Storage can be unavailable (private mode); pins just won't persist.
  }
}

/** Visible-only time in this session, for the completion event. Hidden time never counts. */
function useActiveTime() {
  const total = useRef(0)
  const since = useRef<number | null>(null)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') since.current = performance.now()
      else if (since.current !== null) {
        total.current += performance.now() - since.current
        since.current = null
      }
    }
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  return useCallback(() => total.current + (since.current === null ? 0 : performance.now() - since.current), [])
}

export function Investigation({ initial, onHome }: { initial: RunView; onHome: () => void }) {
  const [run, setRun] = useState(initial)
  const [tab, setTab] = useState<Tab>('desk')
  const [person, setPerson] = useState<string | null>(null)
  const [inspect, setInspect] = useState<string | null>(null)
  const [compare, setCompare] = useState<string[] | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [reviewing, setReviewing] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [opening, setOpening] = useState(false)
  const [pins, setPins] = useState<string[]>(() => readList(`rug-city:pins:${initial.runId}`))
  const activeMs = useActiveTime()

  const send = useCallback(
    async (action: Action): Promise<OutcomeView | null> => {
      try {
        const res = await api<{ run: RunView; outcome: OutcomeView }>(`/api/investigations/${run.runId}/actions`, action)
        setRun(res.run)
        const o = res.outcome
        if (o.evidence?.length) {
          haptic.ok()
          setNotice({ tone: 'ok', text: `New record${o.evidence.length > 1 ? 's' : ''}: ${o.evidence.map((e) => e.title).join(', ')}` })
        } else if (o.finding && !o.repeat) {
          haptic.ok()
          setNotice({ tone: 'ok', text: 'Finding established. It’s on the case desk.' })
        } else if (!o.ok) haptic.error()
        return o
      } catch (e) {
        haptic.error()
        setNotice({ tone: 'error', text: e instanceof ApiError ? e.message : 'Network error, try again.' })
        return null
      }
    },
    [run.runId],
  )

  function openRecord(id: string) {
    setInspect(id)
    const key = `rug-city:opened:${run.runId}`
    const opened = readList(key)
    if (!opened.includes(id)) {
      writeList(key, [...opened, id])
      // Analytics only; nothing waits on it.
      void api(`/api/investigations/${run.runId}/actions`, { type: 'evidence_opened', evidence: id }).catch(() => {})
    }
  }

  function togglePin(id: string) {
    const next = pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id]
    setPins(next)
    writeList(`rug-city:pins:${run.runId}`, next)
  }

  function goPerson(id: string) {
    setInspect(null)
    setPanel(null)
    setTab('people')
    setPerson(id)
  }

  async function restart() {
    try {
      const res = await api<{ run: RunView }>('/api/investigations', { caseId: run.caseId, restart: true })
      setRun(res.run)
      setPins([])
      setTab('desk')
      setPerson(null)
      setReviewing(false)
      setNotice(null)
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof ApiError ? e.message : 'Network error, try again.' })
    }
  }

  async function openCase() {
    setOpening(true)
    await send({ type: 'open_case' })
    setOpening(false)
  }

  // Telegram's back button closes the innermost thing first, then leaves the case.
  useEffect(() => {
    return bindBackButton(() => {
      if (panel) setPanel(null)
      else if (compare) setCompare(null)
      else if (inspect) setInspect(null)
      else if (person) setPerson(null)
      else if (reviewing) setReviewing(false)
      else onHome()
    })
  }, [panel, compare, inspect, person, reviewing, onHome])

  if (run.status === 'intro') return <Intro run={run} onOpen={openCase} busy={opening} />
  if (run.ending && !reviewing) return <Ending run={run} onReview={() => setReviewing(true)} onRestart={restart} onHome={onHome} />

  const selected = run.people.find((p) => p.id === person)

  return (
    <div className="pb-10">
      <header className="px-4 pt-5">
        <div className="flex items-baseline justify-between">
          <Label>Prototype · Chapter 1</Label>
          <button type="button" onClick={reviewing ? () => setReviewing(false) : onHome} className="min-h-11 text-sm text-dim underline underline-offset-4">
            {reviewing ? 'Back to ending' : 'Home'}
          </button>
        </div>
        <h1 className="font-display text-4xl leading-none font-black uppercase">{run.title}</h1>
      </header>

      <nav role="tablist" aria-label="Case sections" className="sticky top-0 z-30 mt-4 flex border-b border-line bg-ink px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id)
              if (t.id === 'people') setPerson(null)
            }}
            className={`min-h-12 flex-1 border-b-4 font-display text-base font-bold tracking-wide uppercase ${tab === t.id ? 'border-tape text-paper' : 'border-transparent text-dim'}`}
          >
            {t.label}
            {t.id === 'evidence' && <span className="ml-1 font-mono text-xs">{run.evidence.length}</span>}
          </button>
        ))}
      </nav>

      {notice && (
        // Above sheets (z-40), so records unlocked from inside a sheet are announced too.
        // At the top, so it never covers a sheet's submit button.
        <div
          role="status"
          aria-live="polite"
          className={`safe-top fixed inset-x-0 top-0 z-50 mx-auto flex max-w-xl items-start gap-2 border-b-4 bg-ink-2 px-4 pt-3 pb-3 text-[15px] shadow-[0_8px_24px_rgba(0,0,0,0.6)] ${notice.tone === 'ok' ? 'border-tape' : 'border-rug'}`}
        >
          <p className="flex-1">{notice.text}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="h-8 w-8 shrink-0 text-dim">
            ✕
          </button>
        </div>
      )}

      <div className="mt-4">
        {tab === 'desk' && (
          <CaseDesk
            run={run}
            pins={pins}
            onInspect={openRecord}
            onPerson={goPerson}
            onCompare={() => setCompare([])}
            onTimeline={() => setPanel('timeline')}
            onHints={() => setPanel('hints')}
            onAccuse={() => setPanel('accuse')}
            send={send}
          />
        )}
        {tab === 'people' &&
          (selected ? (
            <PersonDetail run={run} person={selected} send={send} pins={pins} onTogglePin={togglePin} onInspect={openRecord} onBack={() => setPerson(null)} />
          ) : (
            <PeopleList run={run} onSelect={setPerson} />
          ))}
        {tab === 'evidence' && <EvidenceList run={run} onInspect={openRecord} />}
      </div>

      <EvidenceSheet
        run={run}
        id={inspect}
        onClose={() => setInspect(null)}
        send={send}
        onCompare={(id) => {
          setInspect(null)
          setCompare([id])
        }}
        onContact={goPerson}
      />
      {compare && <Compare run={run} initial={compare} onClose={() => setCompare(null)} send={send} />}
      {panel === 'timeline' && run.timeline && <Timeline run={run} onClose={() => setPanel(null)} send={send} />}
      {panel === 'hints' && <Hints run={run} onClose={() => setPanel(null)} send={send} />}
      {panel === 'accuse' && run.accusation && <Accusation run={run} onClose={() => setPanel(null)} send={send} activeMs={activeMs} />}
    </div>
  )
}
