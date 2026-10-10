'use client'

import { useEffect } from 'react'
import { canShareStory, haptic, shareStory, shareToChat } from '@/lib/telegram/webapp'
import { useGame } from '../GameContext'
import { inviteLink, type PhaseProps } from '../Room'
import { Button, Label, Stamp, Tape } from '../ui'

export function Reveal({ room }: PhaseProps) {
  const { go } = useGame()
  const r = room.result!
  const c = room.case
  const caught = r.correct.culprit
  const minutes = Math.max(1, Math.round(r.elapsedSec / 60))
  const headline = caught ? `Our crew caught the rugger in ${minutes} min` : 'The rugger got away'
  const appLink = inviteLink('').replace(/\?(startapp|room)=$/, '')

  useEffect(() => {
    if (caught) haptic.ok()
    else haptic.thud()
  }, [caught])

  const suspect = (id: string) => c.suspects.find((s) => s.id === id)
  const rows = [
    { label: 'Who did it', pts: r.points.culprit, max: 50, ok: r.correct.culprit, you: suspect(r.group.culprit)?.name, truth: suspect(r.answer.culprit)?.name },
    { label: 'Why', pts: r.points.motive, max: 25, ok: r.correct.motive, you: c.motives.find((m) => m.id === r.group.motive)?.text, truth: c.motives.find((m) => m.id === r.answer.motive)?.text },
    { label: 'The money', pts: r.points.trail, max: 25, ok: r.correct.trail, you: c.trails.find((t) => t.id === r.group.trail)?.text, truth: c.trails.find((t) => t.id === r.answer.trail)?.text },
  ]

  function storyShare() {
    shareStory(`${window.location.origin}/api/verdict/${room.code}`, `${headline} 🕵️ ${r.score}/120 on “${c.title}”. #WhoRugged`, {
      url: appLink,
      name: 'Play Who Rugged?',
    })
  }

  return (
    <div className="pb-12">
      <div className="relative overflow-hidden px-5 pt-10 pb-8 text-center">
        <Stamp tone={caught ? 'rug' : 'paper'} className="text-5xl">
          {caught ? 'Case closed' : 'Cold case'}
        </Stamp>
        <h2 className="mt-8 animate-rise font-display text-4xl leading-none font-black uppercase" style={{ animationDelay: '300ms' }}>
          {headline}
        </h2>
        <div className="mt-6 animate-rise font-mono text-7xl font-semibold text-tape tabular-nums" style={{ animationDelay: '450ms' }}>
          {r.score}
          <span className="text-2xl text-dim">/120</span>
        </div>
        <p className="mt-1 font-mono text-xs text-dim">time bonus +{r.points.time}</p>
      </div>

      <section className="space-y-3 px-4">
        {rows.map((row, i) => (
          <div key={row.label} className="paper animate-rise rounded-sm p-4" style={{ animationDelay: `${600 + i * 120}ms` }}>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-black uppercase">{row.label}</span>
              <span className={`font-mono text-sm font-bold ${row.ok ? 'text-ok' : 'text-rug'}`}>
                {row.ok ? '✓' : '✗'} {row.pts}/{row.max}
              </span>
            </div>
            <p className="mt-1 font-type text-sm">
              <span className="text-paper-ink/60">Crew said:</span> {row.you}
            </p>
            {!row.ok && (
              <p className="font-type text-sm">
                <span className="text-paper-ink/60">Truth:</span> <b>{row.truth}</b>
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="mt-8 px-5">
        <Label>What really happened</Label>
        <div className="mt-3 space-y-3 border-l-2 border-rug pl-4 text-[15px] leading-relaxed text-paper/90">
          {r.reveal.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-3 px-5">
        <Tape>Spread the word</Tape>
        {canShareStory() && (
          <Button className="w-full" onClick={storyShare}>
            Share verdict to story
          </Button>
        )}
        <Button
          variant={canShareStory() ? 'ghost' : 'primary'}
          className="w-full"
          onClick={() => shareToChat(appLink, `🕵️ ${headline} on “${c.title}” · ${r.score}/120. Think your crew is faster?`)}
        >
          Send to a chat
        </Button>
        <Button variant="paper" className="w-full" onClick={() => go({ name: 'home' })}>
          Next case
        </Button>
      </section>
    </div>
  )
}
