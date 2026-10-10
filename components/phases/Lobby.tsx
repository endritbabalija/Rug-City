'use client'

import { MAX_PLAYERS } from '@/lib/game/types'
import { shareToChat } from '@/lib/telegram/webapp'
import { useGame } from '../GameContext'
import { inviteLink, type PhaseProps } from '../Room'
import { Button, Label, Stamp } from '../ui'

export function Lobby({ room, run, busy }: PhaseProps) {
  const { player, go, buy, toast } = useGame()
  const isHost = room.me.isHost
  const link = inviteLink(room.code)
  const minPlayers = room.minPlayers
  const enough = room.players.length >= minPlayers
  const hasCase = player.freeCaseAvailable || player.caseCredits > 0

  async function start() {
    if (!hasCase) {
      if (!(await buy('pack5'))) return
    }
    await run({ type: 'start' })
  }

  return (
    <div className="px-5 pt-6">
      <div className="text-center">
        <Label>Case code</Label>
        <div className="mt-1 font-mono text-6xl font-semibold tracking-[0.25em] text-tape">{room.code}</div>
        <p className="mt-2 text-sm text-dim">{room.case.crime}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          onClick={() =>
            shareToChat(link, `🚨 ${room.case.title}: ${room.case.tagline}\nJoin my crew and help work out who rugged.`)
          }
        >
          Invite crew
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              toast('Invite link copied.', 'ok')
            } catch {
              toast(link)
            }
          }}
        >
          Copy link
        </Button>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <Label>Detectives</Label>
          <span className="font-mono text-xs text-dim">
            {room.players.length}/{MAX_PLAYERS} · need {minPlayers}+
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => room.players[i]).map((p, i) =>
            p ? (
              <li key={p.id} className="flex animate-rise items-center gap-3 rounded-md border border-line bg-ink-2 px-4 py-3">
                <span className="font-mono text-xs text-dim">#{i + 1}</span>
                <span className="flex-1 truncate font-semibold">
                  {p.badge ? `${p.badge} ` : ''}
                  {p.name}
                  {p.id === room.me.id && <span className="text-dim"> (you)</span>}
                </span>
                {p.id === room.hostId && <span className="font-display text-xs font-bold tracking-widest text-tape uppercase">Host</span>}
              </li>
            ) : (
              <li key={`empty-${i}`} className="rounded-md border border-dashed border-line/70 px-4 py-3 text-sm text-line">
                Waiting for a detective…
              </li>
            ),
          )}
        </ul>
      </section>

      <div className="mt-8">
        {isHost ? (
          <>
            <Button className="w-full" disabled={!enough} busy={busy === 'start'} onClick={start}>
              {enough ? (hasCase ? 'Open the case file' : 'Get cases & start · ⭐250') : `Need ${minPlayers - room.players.length} more`}
            </Button>
            <p className="mt-2 text-center text-xs text-dim">
              {player.freeCaseAvailable
                ? 'Uses your free case for today.'
                : player.caseCredits > 0
                  ? `Uses 1 of your ${player.caseCredits} cases.`
                  : "You've used today's free case. A pack gives you 5 more."}
            </p>
          </>
        ) : (
          <div className="py-4 text-center">
            <Stamp tone="paper" className="text-xl">
              Waiting for host
            </Stamp>
          </div>
        )}
        <button
          className="mt-6 w-full text-center text-sm text-dim underline underline-offset-4"
          onClick={async () => {
            if (await run({ type: 'leave' })) go({ name: 'home' })
          }}
        >
          Leave this case
        </button>
      </div>
    </div>
  )
}
