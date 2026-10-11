'use client'

import type { ReactNode } from 'react'
import type { Action } from '@/lib/investigation/types'
import type { EvidenceView, OutcomeView } from '@/lib/investigation/view'
import { haptic } from '@/lib/telegram/webapp'

/** Send one action; resolves to its outcome, or null if the request failed (already reported). */
export type Send = (action: Action) => Promise<OutcomeView | null>

export const KIND_LABEL: Record<EvidenceView['kind'], string> = {
  public: 'Public record',
  supplied: 'Supplied record',
  service: 'Service record',
  voluntary: 'Voluntary disclosure',
}

/** A tap-to-select toggle. Selection is shown by text and border, not colour alone. */
export function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => {
        haptic.select()
        onClick()
      }}
      className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-[15px] leading-snug transition disabled:opacity-40 ${
        selected ? 'border-tape bg-tape/10 text-paper' : 'border-line bg-ink-2 text-paper/85'
      }`}
    >
      <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-sm border text-xs font-black ${selected ? 'border-tape bg-tape text-ink' : 'border-dim'}`}>
        {selected ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

/** Feedback on a wrong or unsupported theory. Progress is never lost, so it reads "Not yet". */
export function Feedback({ outcome }: { outcome: OutcomeView | null }) {
  if (!outcome || outcome.ok || !outcome.feedback) return null
  return (
    <p role="status" aria-live="polite" className="mt-3 rounded-md border border-rug/60 px-3 py-2 text-[15px] leading-snug text-paper">
      <b className="mr-1 text-rug">Not yet.</b>
      {outcome.feedback}
    </p>
  )
}

export function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 text-left font-semibold text-tape underline underline-offset-4">
      {children}
    </button>
  )
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <div aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-paper font-display text-lg font-black text-paper-ink shadow-[3px_3px_0_var(--color-rug)]">
      {initials}
    </div>
  )
}
