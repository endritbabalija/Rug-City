'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
import type { RunStatus } from '@/lib/investigation/types'
import type { RunView } from '@/lib/investigation/view'
import { Button, Label, Pill } from '../ui'

const CASE_ID = 'the-refund'

/** Home entry for The Refund prototype (behind `refund_prototype`). Starting is free. */
export function RefundCard({ onOpen }: { onOpen: (run: RunView) => void }) {
  const [latest, setLatest] = useState<{ runId: string; status: RunStatus } | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ run: { runId: string; status: RunStatus } | null }>(`/api/investigations?case=${CASE_ID}`)
      .then((r) => setLatest(r.run))
      .catch(() => setLatest(null))
  }, [])

  async function open() {
    setBusy(true)
    setError(null)
    try {
      onOpen((await api<{ run: RunView }>('/api/investigations', { caseId: CASE_ID })).run)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open the case file.')
      setBusy(false)
    }
  }

  const label = latest?.status === 'resolved' ? 'Review the case' : latest ? 'Continue' : 'Open the case'

  return (
    <section className="mx-5 border-y border-line py-5">
      <div className="flex items-center justify-between gap-2">
        <Label>Chapter 1 · The Refund</Label>
        <Pill tone="tape">Prototype</Pill>
      </div>
      <p className="mt-2 text-[15px] text-paper/85">A founder hires you to blame her treasury operator. 12,000 LUM of community refunds went somewhere else.</p>
      {latest?.status === 'resolved' && <p className="mt-1 text-sm text-ok">Case closed.</p>}
      <Button className="mt-4 w-full" busy={busy} disabled={latest === undefined} onClick={open}>
        {label}
      </Button>
      {error && <p className="mt-2 text-sm text-rug">{error}</p>}
    </section>
  )
}
