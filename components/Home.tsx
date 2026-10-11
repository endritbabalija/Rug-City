'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
import { useGame } from './GameContext'
import { Button, Label, Pill, Stamp, Tape } from './ui'

export function Home() {
  const { player, cases, badges, go, toast } = useGame()
  const [busy, setBusy] = useState<string | null>(null)
  const [code, setCode] = useState('')

  async function host(caseId: string) {
    setBusy(caseId)
    try {
      const res = await api<{ code: string }>('/api/rooms', { caseId })
      go({ name: 'room', code: res.code })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not open the case.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const badge = player.activeBadge ? badges[player.activeBadge] : null

  return (
    <div className="pb-10">
      <Tape>Crime scene · do not cross</Tape>

      <header className="relative px-5 pt-8 pb-6">
        <button onClick={() => go({ name: 'profile' })} className="font-mono text-xs text-dim">
          {player.progress.rank.title.toUpperCase()} {badge ? `${badge.icon} ` : ''}
          {player.name.toUpperCase()} · <span className="text-tape">{player.progress.cluePoints.toLocaleString()} CP ›</span>
        </button>
        <h1 className="mt-2 font-display text-[4.6rem] leading-[0.82] font-black uppercase">
          Who
          <br />
          <span className="relative inline-block">
            Rugged
            <span className="absolute -top-2 -right-9 text-rug">?</span>
          </span>
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-snug text-paper/80">
          A project just got rugged. Your crew has 20 minutes to work out <b className="text-tape">who</b>, <b className="text-tape">why</b>, and{' '}
          <b className="text-tape">where the money went</b>.
        </p>
        <div className="absolute top-10 right-5">
          <Stamp className="text-lg">Case open</Stamp>
        </div>
      </header>

      <section className="mx-5 flex flex-wrap items-center gap-2 border-y border-line py-3">
        {player.freeCaseAvailable ? <Pill tone="ok">● Free case today</Pill> : <Pill>Free case used</Pill>}
        <Pill tone="tape">🗂️ {player.caseCredits} cases</Pill>
        <Pill>⚖️ {player.items.subpoena}</Pill>
        <Pill>🧭 {player.items.trace}</Pill>
        <Pill>💡 {player.items.hint}</Pill>
        {player.progress.streakDays > 0 && <Pill tone="tape">🔥 {player.progress.streakDays}</Pill>}
        <button onClick={() => go({ name: 'profile' })} className="ml-auto font-display text-sm font-bold tracking-widest text-paper uppercase underline underline-offset-4">
          Profile
        </button>
        <button onClick={() => go({ name: 'shop' })} className="ml-3 font-display text-sm font-bold tracking-widest text-tape uppercase underline underline-offset-4">
          Shop ⭐
        </button>
      </section>

      <section className="mt-6 space-y-5 px-5">
        <Label>Open case files</Label>
        {cases.map((c, i) => (
          <article key={c.id} className="paper relative animate-rise overflow-hidden rounded-sm p-5" style={{ animationDelay: `${i * 90}ms`, rotate: `${i % 2 ? 0.6 : -0.5}deg` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="font-type text-xs tracking-widest text-paper-ink/60 uppercase">Case {(i + 1).toString().padStart(2, '0')} · {c.ticker}</div>
              <div className="font-type text-xs text-paper-ink/60">{c.suspects} suspects</div>
            </div>
            <h2 className="mt-2 font-display text-[2.1rem] leading-none font-black uppercase">{c.title}</h2>
            <p className="mt-1 font-type text-sm font-bold text-rug uppercase">{c.crime}</p>
            <p className="mt-3 font-type text-[15px] leading-snug">{c.tagline}</p>
            <Button className="mt-4 w-full" busy={busy === c.id} onClick={() => host(c.id)}>
              Host this case
            </Button>
          </article>
        ))}
      </section>

      <section className="mt-8 px-5">
        <Label>Got a case code?</Label>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^[A-Za-z0-9]{5}$/.test(code)) go({ name: 'room', code: code.toUpperCase() })
            else toast('Case codes are 5 characters.', 'error')
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="K7Q2M"
            autoCapitalize="characters"
            className="min-h-12 w-full rounded-md border border-line bg-ink-2 px-4 font-mono text-xl tracking-[0.4em] text-paper uppercase placeholder:text-line focus:border-tape focus:outline-none"
          />
          <Button variant="ghost" type="submit">
            Join
          </Button>
        </form>
      </section>

      <section className="mt-10 px-5">
        <Label>How a case works</Label>
        <ol className="mt-3 space-y-3 text-[15px] text-paper/85">
          {[
            ['Brief', 'Everyone reads the same case file and timeline.'],
            ['Split up', 'Each detective gets different clues, and suspects DM you with their side.'],
            ['Accuse', 'Vote on who did it, why, and where the money went.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="font-display text-3xl leading-none font-black text-rug">{i + 1}</span>
              <span>
                <b className="font-display text-lg tracking-wide uppercase">{t}.</b> {d}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-dim">All projects, people and wallets are fictional parody. Cases teach how rugs are spotted, never how to run one.</p>
      </section>
    </div>
  )
}
