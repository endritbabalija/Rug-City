'use client'

import type { PublicSuspect } from '@/lib/game/view'

const ROLE: Record<string, string> = {
  'anon-dev': 'Anon dev',
  influencer: 'Influencer',
  'co-founder': 'Co-founder',
  'community-mod': 'Community mod',
  'audit-firm': 'Audit firm',
  whale: 'Whale',
}

export function SuspectCard({ suspect, compact, action }: { suspect: PublicSuspect; compact?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-ink-2 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-paper text-2xl shadow-[3px_3px_0_var(--color-rug)]">{suspect.avatar}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-lg leading-tight font-bold uppercase">{suspect.name}</span>
          <span className="shrink-0 font-mono text-[10px] tracking-wider text-tape uppercase">{ROLE[suspect.archetype] ?? suspect.archetype}</span>
        </div>
        {!compact && <p className="text-sm leading-snug text-paper/70">{suspect.blurb}</p>}
        <p className="text-sm text-dim italic">“{suspect.cover}”</p>
      </div>
      {action}
    </div>
  )
}
