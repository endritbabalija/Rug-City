'use client'

import { useState } from 'react'
import type { ExplorerWallet } from '@/lib/game/view'
import { useGame } from '../GameContext'
import type { PhaseProps } from '../Room'
import { Button, Confirm, Label, Sheet } from '../ui'
import { helpCost } from './helpCost'

export function Explorer({ room, run, busy }: PhaseProps) {
  const { player, buy } = useGame()
  const { wallets, txs } = room.explorer
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const byId = new Map(wallets.map((w) => [w.id, w]))
  const open = openId ? byId.get(openId) : null
  const name = (id: string) => byId.get(id)?.label ?? id

  async function trace(w: ExplorerWallet) {
    setConfirming(null)
    if (player.items.trace <= 0 && !(await buy('trace'))) return
    await run({ type: 'trace', walletId: w.id }, `trace:${w.id}`)
  }

  return (
    <div className="px-4">
      <div className="rounded-md border border-line bg-ink-2 p-3">
        <div className="flex items-center gap-2 font-mono text-xs text-dim">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> TONSCAN-ISH · fictional chain data
        </div>
      </div>

      <Label className="mt-5">Wallets</Label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {wallets.map((w) => (
          <button key={w.id} onClick={() => setOpenId(w.id)} className="rounded-md border border-line bg-ink-2 p-3 text-left active:bg-ink-3">
            <div className="font-mono text-xs text-tape">{w.address}</div>
            <div className="mt-1 text-sm leading-tight font-semibold">{w.label}</div>
            <div className="mt-1 font-mono text-[10px] text-dim">{w.traceable ? 'source hidden' : 'source known'}</div>
          </button>
        ))}
      </div>

      <Label className="mt-6">Transactions</Label>
      <ol className="mt-2 divide-y divide-line rounded-md border border-line bg-ink-2">
        {txs.map((t) => (
          <li key={t.id} className="p-3">
            <div className="flex justify-between font-mono text-[11px] text-dim">
              <span>{t.at}</span>
              {t.memo && <span className="truncate pl-2 text-paper/60">{t.memo}</span>}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <button className="truncate text-left underline decoration-line underline-offset-2" onClick={() => setOpenId(t.from)}>
                {name(t.from)}
              </button>
              <span className="text-rug">→</span>
              <button className="truncate text-left underline decoration-line underline-offset-2" onClick={() => setOpenId(t.to)}>
                {name(t.to)}
              </button>
            </div>
            <div className="font-mono text-sm font-semibold text-tape">
              {t.amount} {t.token}
            </div>
          </li>
        ))}
      </ol>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.label ?? ''}>
        {open && (
          <div>
            <div className="font-mono text-lg text-tape">{open.address}</div>
            {open.note && <p className="mt-1 text-sm text-dim">{open.note}</p>}

            <Label className="mt-5">First funded by</Label>
            {open.fundedBy ? (
              <p className="mt-1 font-type text-base">{open.fundedBy}</p>
            ) : (
              <div className="mt-2">
                <div className="redacted h-6 w-full">hidden</div>
                {confirming === open.id ? (
                  <div className="mt-3">
                    <Confirm yes="Trace it" busy={busy === `trace:${open.id}`} onYes={() => trace(open)} onNo={() => setConfirming(null)}>
                      {helpCost('trace', { owned: player.items.trace, crew: room.mode === 'crew' })}
                    </Confirm>
                  </div>
                ) : (
                  <Button className="mt-3 w-full" busy={busy === `trace:${open.id}`} onClick={() => setConfirming(open.id)}>
                    🧭 Trace it {player.items.trace > 0 ? `(${player.items.trace} left)` : '· ⭐15'}
                  </Button>
                )}
                <p className="mt-2 text-xs text-dim">
                  {room.mode === 'solo' ? "Reveals the source. One of Dex's clues might reveal it too." : "Reveals the source to your whole crew. A teammate's clue might reveal it too."}
                </p>
              </div>
            )}

            <Label className="mt-5">Activity</Label>
            <ul className="mt-2 space-y-2">
              {txs
                .filter((t) => t.from === open.id || t.to === open.id)
                .map((t) => (
                  <li key={t.id} className="rounded border border-line p-2 text-sm">
                    <span className="font-mono text-[11px] text-dim">{t.at}</span>
                    <div>
                      {t.from === open.id ? (
                        <>
                          <span className="text-rug">OUT</span> {t.amount} {t.token} → {name(t.to)}
                        </>
                      ) : (
                        <>
                          <span className="text-ok">IN</span> {t.amount} {t.token} ← {name(t.from)}
                        </>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Sheet>
    </div>
  )
}
