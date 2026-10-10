'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
import type { PublicPlayer } from '@/lib/server'
import { useGame } from './GameContext'
import { Button, Label, Tape } from './ui'

export function Shop() {
  const { player, skus, badges, buy, go, setPlayer, toast } = useGame()
  const [busy, setBusy] = useState<string | null>(null)

  async function purchase(id: string) {
    setBusy(id)
    await buy(id)
    setBusy(null)
  }

  async function equip(badge: string | null) {
    try {
      const res = await api<{ player: PublicPlayer }>('/api/me', { activeBadge: badge })
      setPlayer(res.player)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not equip that.', 'error')
    }
  }

  const sections = [
    { kind: 'pack', title: 'Case packs', note: 'One free case a day. Packs let you host more.' },
    { kind: 'powerup', title: 'Power-ups', note: 'Used during a case. Hints and Traces show up for the whole crew.' },
    { kind: 'badge', title: 'Detective badges', note: 'Cosmetic. Shows next to your name in lobbies and on verdict cards.' },
  ] as const

  return (
    <div className="pb-12">
      <Tape>Evidence locker</Tape>
      <div className="flex items-end justify-between px-5 pt-6">
        <h1 className="font-display text-5xl leading-none font-black uppercase">Shop</h1>
        <button onClick={() => go({ name: 'home' })} className="font-display text-sm font-bold tracking-widest text-dim uppercase">
          ← Cases
        </button>
      </div>
      <p className="mt-2 px-5 text-sm text-dim">Paid with Telegram Stars. No tokens, no airdrops.</p>

      {sections.map((s) => (
        <section key={s.kind} className="mt-8 px-5">
          <Label>{s.title}</Label>
          <p className="mt-1 text-xs text-dim">{s.note}</p>
          <div className="mt-3 space-y-3">
            {skus
              .filter((k) => k.kind === s.kind)
              .map((k) => {
                const owned = k.grant.badge ? player.badges.includes(k.grant.badge) : false
                const equipped = owned && player.activeBadge === k.grant.badge
                const count = k.grant.items ? Object.keys(k.grant.items).map((i) => player.items[i as keyof typeof player.items])[0] : k.grant.caseCredits ? player.caseCredits : null
                return (
                  <div key={k.id} className="flex items-center gap-4 rounded-md border border-line bg-ink-2 p-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-ink-3 text-2xl">{k.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-display text-xl font-bold uppercase">{k.title}</h3>
                        {count !== null && <span className="font-mono text-xs text-dim">×{count}</span>}
                      </div>
                      <p className="text-sm leading-snug text-paper/70">{k.description}</p>
                    </div>
                    {owned ? (
                      <Button variant={equipped ? 'ghost' : 'paper'} className="min-h-10 px-3 text-base" onClick={() => equip(equipped ? null : k.grant.badge!)}>
                        {equipped ? 'Remove' : 'Wear'}
                      </Button>
                    ) : (
                      <Button className="min-h-10 px-3 text-base" busy={busy === k.id} onClick={() => purchase(k.id)}>
                        ⭐ {k.stars}
                      </Button>
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      ))}

      {player.badges.length > 0 && (
        <p className="mt-8 px-5 text-xs text-dim">
          Your badges: {player.badges.map((b) => `${badges[b]?.icon} ${badges[b]?.name}`).join(', ')}
        </p>
      )}
      <p className="mt-6 px-5 text-xs text-dim">Payment problems? Message the bot with /paysupport.</p>
    </div>
  )
}
