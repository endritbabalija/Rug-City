'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
import { ELITE_SHARE, RATING_BEST_OF, TOP_PRIZE_COUNT } from '@/lib/game/progress'
import { useGame } from './GameContext'
import { Label, Tape } from './ui'

interface Board {
  season: number
  start: number
  end: number
  total: number
  me: number | null
  rows: { position: number; me: boolean; name: string; badge: string | null; rating: number; cases: number }[]
}

export function Leaderboard() {
  const { player, go } = useGame()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Board>('/api/leaderboard')
      .then(setBoard)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Could not load the leaderboard.'))
  }, [])

  const mineVisible = board?.rows.some((r) => r.me)
  // eslint-disable-next-line react-hooks/purity -- a day-granularity countdown; re-render drift doesn't matter
  const daysLeft = board ? Math.max(0, Math.ceil((board.end - Date.now()) / 86_400_000)) : 0

  return (
    <div className="pb-12">
      <Tape>Most wanted detectives</Tape>
      <div className="flex items-end justify-between px-5 pt-6">
        <div>
          <p className="font-mono text-xs text-dim">{board ? `SEASON ${board.season} · ${daysLeft} DAYS LEFT` : 'SEASON'}</p>
          <h1 className="mt-1 font-display text-5xl leading-none font-black uppercase">Leaderboard</h1>
        </div>
        <button onClick={() => go({ name: 'profile' })} className="font-display text-sm font-bold tracking-widest text-dim uppercase">
          ← Profile
        </button>
      </div>
      <p className="mt-2 px-5 text-sm text-dim">
        Detective Rating: best {RATING_BEST_OF} cases this season. At season end the top {TOP_PRIZE_COUNT} get a 🏆 badge and a free case pack, and the top {ELITE_SHARE * 100}% get a 🎖️ badge.
      </p>

      {error && <p className="mt-8 px-5 text-rug">{error}</p>}
      {!board && !error && <p className="mt-8 animate-flicker px-5 font-display tracking-[0.3em] text-tape uppercase">Pulling records…</p>}

      {board && (
        <section className="mt-6 px-5">
          <Label>{board.total.toLocaleString()} ranked detectives</Label>
          {board.rows.length === 0 ? (
            <p className="mt-3 text-sm text-dim">Nobody is ranked yet this season. Close a case with your crew to be first.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line rounded-md border border-line bg-ink-2">
              {board.rows.map((r) => {
                const me = r.me
                const prize = r.position <= TOP_PRIZE_COUNT ? '🏆' : r.position <= Math.ceil(board.total * ELITE_SHARE) ? '🎖️' : ''
                return (
                  <li key={r.position} className={`flex items-center gap-3 px-4 py-2.5 ${me ? 'bg-tape/10' : ''}`}>
                    <span className={`w-8 font-mono text-sm tabular-nums ${r.position <= 3 ? 'text-tape' : 'text-dim'}`}>#{r.position}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.badge ? `${r.badge} ` : ''}
                      <b className={me ? 'text-tape' : ''}>{r.name}</b>
                    </span>
                    <span className="font-mono text-[11px] text-dim">{r.cases} cases</span>
                    <span className="w-14 text-right font-mono font-semibold tabular-nums">{r.rating}</span>
                    <span className="w-5 text-center">{prize}</span>
                  </li>
                )
              })}
            </ol>
          )}
          {!mineVisible && (
            <p className="mt-4 rounded-md border border-line px-4 py-3 text-sm">
              {board.me ? (
                <>
                  You&apos;re <b className="text-tape">#{board.me}</b> of {board.total.toLocaleString()} with a rating of {player.progress.season.rating}.
                </>
              ) : (
                'You are not ranked yet. Finish a case to get on the board.'
              )}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
