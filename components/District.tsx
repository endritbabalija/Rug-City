'use client'

import type { DistrictSummary } from '@/lib/cases'
import { CaseCard } from './CaseCard'
import { useGame } from './GameContext'
import { Button, Label, Tape } from './ui'

const dropDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Home with flag `districts`: the Next case card first, then Rug City as a progress map. */
export function DistrictMap() {
  const { cases, districts, nextCase, nextDrop, go } = useGame()
  const next = nextCase ? cases.find((c) => c.id === nextCase.id) : undefined
  const nextDistrict = next && districts.find((d) => d.id === next.district)
  const moreNew = next ? cases.filter((c) => c.district === next.district && c.id !== next.id && !c.played).length : 0
  const hasTeasers = districts.some((d) => d.state === 'teaser')

  return (
    <>
      <section className="mt-6 space-y-3 px-5">
        <Label>Next case</Label>
        {next ? (
          <>
            <CaseCard c={next} index={0} startHere={nextCase!.startHere} />
            {nextDistrict && (
              <button onClick={() => go({ name: 'district', id: nextDistrict.id })} className="block w-full py-1 text-left font-mono text-xs text-tape">
                More {nextDistrict.name} cases{moreNew ? ` (${moreNew} new)` : ''} ›
              </button>
            )}
          </>
        ) : (
          <p className="rounded-md border border-dashed border-line px-4 py-4 text-center font-mono text-xs text-dim">
            All caught up. {nextDrop ? `Next case drops on ${dropDate(nextDrop)}.` : 'New cases are on the way.'}
            {hasTeasers && ' Meanwhile, try a teaser case below.'}
          </p>
        )}
      </section>

      <section className="mt-8 space-y-3 px-5">
        <Label>Rug City</Label>
        <p className="text-sm text-dim">Rank up to open the next district.</p>
        {districts.map((d, i) => {
          const inside = cases.filter((c) => c.district === d.id)
          const fresh = inside.filter((c) => !c.played).length
          const locked = d.state !== 'open'
          const share = d.unlock.need ? d.unlock.have / d.unlock.need : 1
          return (
            <button
              key={d.id}
              onClick={() => go({ name: 'district', id: d.id })}
              className={`block w-full animate-rise rounded-md border px-4 py-4 text-left ${locked ? 'border-line bg-ink-2/60' : 'border-tape/60 bg-ink-2'}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-dim">District {String(d.order).padStart(2, '0')}</span>
                <span className={`font-mono text-xs ${locked ? 'text-dim' : 'text-tape'}`}>
                  {locked ? `🔒 ${d.unlockRank}` : `✓ open · ${fresh ? `${fresh} new` : 'all closed'} ›`}
                </span>
              </div>
              <h2 className={`mt-1 font-display text-3xl leading-none font-black uppercase ${locked ? 'text-paper/60' : ''}`}>{d.name}</h2>
              <p className="mt-1 text-sm text-paper/70">{d.crimes}</p>
              {locked && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-3" role="progressbar" aria-valuemin={0} aria-valuemax={d.unlock.need} aria-valuenow={d.unlock.have}>
                    <div className="h-full rounded-full bg-tape" style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-dim">
                    {d.unlock.have.toLocaleString()} / {d.unlock.need.toLocaleString()} CP to {d.unlockRank}
                  </p>
                </div>
              )}
              {d.state === 'teaser' && (
                <p className="mt-2 font-mono text-xs text-tape">
                  {inside.length === 1 ? '1 teaser case' : `${inside.length} teaser cases`}, free to play ›
                </p>
              )}
            </button>
          )
        })}
      </section>
    </>
  )
}

/** One district: its cases if it's open, or the rank it needs and its teaser if it's locked. */
export function District({ id }: { id: string }) {
  const { player, cases, districts, go } = useGame()
  const d: DistrictSummary | undefined = districts.find((x) => x.id === id)
  const inside = cases.filter((c) => c.district === id)

  return (
    <div className="pb-10">
      <Tape>{d?.state === 'open' ? 'District open' : 'Restricted area'}</Tape>
      <header className="px-5 pt-6 pb-4">
        <button onClick={() => go({ name: 'home' })} className="font-mono text-xs text-dim">
          ‹ Map
        </button>
        <h1 className="mt-2 font-display text-5xl leading-[0.9] font-black uppercase">{d?.name ?? 'Unknown district'}</h1>
        {d && (
          <dl className="mt-3 space-y-1 text-sm text-paper/80">
            <div>
              <dt className="inline font-mono text-xs text-dim uppercase">Crimes · </dt>
              <dd className="inline">{d.crimes}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-xs text-dim uppercase">Skill · </dt>
              <dd className="inline">{d.skill}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-xs text-dim uppercase">Boss · </dt>
              <dd className="inline">{d.boss}</dd>
            </div>
          </dl>
        )}
      </header>

      {d && d.state !== 'open' && (
        <section className="mx-5 mb-4 rounded-md border border-line bg-ink-2 px-4 py-3">
          <p className="font-display text-xl font-bold uppercase">🔒 Opens at {d.unlockRank}</p>
          <p className="mt-1 text-sm text-dim">
            You&apos;re {player.progress.rank.title} with {player.progress.cluePoints.toLocaleString()} Clue Points.
            {inside.length > 0 && ' The teaser below is open to everyone.'}
          </p>
        </section>
      )}

      <section className="space-y-5 px-5">
        {d && <Label>{d.state === 'open' ? 'Case files' : 'Teaser case'}</Label>}
        {inside.map((c, i) => (
          <CaseCard key={c.id} c={c} index={i} />
        ))}
        {!d && (
          <Button variant="ghost" className="w-full" onClick={() => go({ name: 'home' })}>
            Back to the map
          </Button>
        )}
      </section>
    </div>
  )
}
