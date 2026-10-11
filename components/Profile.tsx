'use client'

import { api, ApiError } from '@/lib/client/api'
import { POINTS, RATED_MIN_SEATS, RATED_PER_DAY, RATING_BEST_OF, RANKS, REFERRAL_POINTS } from '@/lib/game/progress'
import type { PublicPlayer } from '@/lib/server'
import { useGame } from './GameContext'
import { Button, Label, Pill, Tape } from './ui'

const DAY_MS = 86_400_000

export function Profile() {
  const { player, badges, go, setPlayer, toast } = useGame()
  const { cluePoints, rank, streakDays, season, recent } = player.progress
  const span = rank.next ? rank.next.at - rank.at : 1
  const pct = rank.next ? Math.min(100, Math.round(((cluePoints - rank.at) / span) * 100)) : 100
  const daysLeft = Math.max(0, Math.ceil((season.endsAt - Date.now()) / DAY_MS))

  async function equip(badge: string | null) {
    try {
      const res = await api<{ player: PublicPlayer }>('/api/me', { activeBadge: badge })
      setPlayer(res.player)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not equip that.', 'error')
    }
  }

  return (
    <div className="pb-12">
      <Tape>Personnel file</Tape>
      <div className="flex items-end justify-between px-5 pt-6">
        <div>
          <p className="font-mono text-xs text-dim">DETECTIVE {player.name.toUpperCase()}</p>
          <h1 className="mt-1 font-display text-5xl leading-none font-black uppercase">{rank.title}</h1>
        </div>
        <button onClick={() => go({ name: 'home' })} className="font-display text-sm font-bold tracking-widest text-dim uppercase">
          ← Cases
        </button>
      </div>

      <section className="mx-5 mt-6 rounded-md border border-line bg-ink-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-4xl font-semibold text-tape tabular-nums">{cluePoints.toLocaleString()}</span>
          <span className="font-display text-sm font-bold tracking-widest text-dim uppercase">Clue Points</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-3">
          <div className="h-full rounded-full bg-tape transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-dim">
          {rank.next ? `${(rank.next.at - cluePoints).toLocaleString()} to ${rank.next.title}` : 'Top rank. The whole department answers to you.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone={streakDays > 0 ? 'tape' : 'dim'}>🔥 {streakDays}-day streak</Pill>
          {RANKS.map((r) => (
            <Pill key={r.title} tone={cluePoints >= r.at ? 'ok' : 'dim'}>
              {r.title}
            </Pill>
          ))}
        </div>
      </section>

      <section className="paper mx-5 mt-5 rounded-sm p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-black uppercase">Season {season.id}</span>
          <span className="font-type text-xs text-paper-ink/60">{daysLeft} days left</span>
        </div>
        <div className="mt-3 flex items-end gap-6">
          <div>
            <div className="font-mono text-4xl font-semibold tabular-nums">{season.rating}</div>
            <div className="font-type text-xs text-paper-ink/60 uppercase">Detective Rating</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {season.cases}/{RATING_BEST_OF}
            </div>
            <div className="font-type text-xs text-paper-ink/60 uppercase">Cases counted</div>
          </div>
        </div>
        <p className="mt-3 font-type text-sm leading-snug">
          Your rating is your best {RATING_BEST_OF} cases this season: your own vote's accuracy plus speed. Cases where your crew used a power-up don't count.
        </p>
        <Button variant="ghost" className="mt-4 w-full" onClick={() => go({ name: 'leaderboard' })}>
          Season leaderboard
        </Button>
      </section>

      <section className="mt-8 px-5">
        <Label>Recent cases</Label>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-dim">No cases closed yet. Host one with your crew.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line rounded-md border border-line bg-ink-2">
            {recent.map((r) => (
              <li key={`${r.caseId}:${r.at}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-bold uppercase">{r.title}</div>
                  <div className="font-mono text-[11px] text-dim">
                    {new Date(r.at).toLocaleDateString()} · {r.correct}/3 right{r.rating !== undefined ? ` · rating ${r.rating}` : ''}
                    {r.unrated ? ' · not rated' : ''}
                  </div>
                </div>
                <span className={`font-mono text-sm font-bold ${r.points ? 'text-tape' : 'text-dim'}`}>+{r.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {player.badges.length > 0 && (
        <section className="mt-8 px-5">
          <Label>Badges</Label>
          <div className="mt-2 space-y-2">
            {player.badges.map((id) => {
              const b = badges[id]
              if (!b) return null
              const worn = player.activeBadge === id
              return (
                <div key={id} className="flex items-center gap-3 rounded-md border border-line bg-ink-2 px-4 py-2">
                  <span className="text-2xl">{b.icon}</span>
                  <span className="flex-1 font-display text-base font-bold uppercase">{b.name}</span>
                  <Button variant={worn ? 'ghost' : 'paper'} className="min-h-9 px-3 text-sm" onClick={() => equip(worn ? null : id)}>
                    {worn ? 'Remove' : 'Wear'}
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-8 px-5">
        <Label>How Clue Points work</Label>
        <ul className="mt-2 space-y-1.5 text-sm text-paper/80">
          <li>
            Your own vote: culprit +{POINTS.culprit}, motive +{POINTS.motive}, money trail +{POINTS.trail}.
          </li>
          <li>
            Crew caught the culprit: +{POINTS.crew}, plus up to +{POINTS.speedMax} for speed.
          </li>
          <li>
            First case each day: +{POINTS.streakPerDay} per day of streak, up to +{POINTS.streakMax}.
          </li>
          <li>Invite a friend: +{REFERRAL_POINTS} when they finish their first rated case.</li>
          <li>
            Only your first time through a case counts, with a crew of {RATED_MIN_SEATS} or more, up to {RATED_PER_DAY} cases a day.
          </li>
        </ul>
        <p className="mt-4 text-xs text-dim">Clue Points and ratings are bragging rights. They can't be bought, have no cash value and never turn into a token.</p>
      </section>
    </div>
  )
}
