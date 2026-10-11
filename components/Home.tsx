'use client'

import type { RunView } from '@/lib/investigation/view'
import type { PublicPlayer } from '@/lib/server'
import { RefundCard } from './investigation/RefundCard'
import { Label, Stamp, Tape } from './ui'

/** Home. With `refund_prototype` on it shows The Refund's entry card; otherwise a placeholder. */
export function Home({ player, refund, onOpenRun }: { player: PublicPlayer; refund: boolean; onOpenRun: (run: RunView) => void }) {
  return (
    <div className="pb-10">
      <Tape>Crime scene · do not cross</Tape>

      <header className="relative px-5 pt-8 pb-6">
        <p className="font-mono text-xs text-dim">DETECTIVE {player.name.toUpperCase()}</p>
        <h1 className="mt-2 font-display text-[4.6rem] leading-[0.82] font-black uppercase">
          Rug
          <br />
          City
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-snug text-paper/80">
          Uncover the human choices behind crypto scandals, and <b className="text-tape">prove what happened with evidence</b>.
        </p>
        <div className="absolute top-10 right-5">
          <Stamp className="text-lg">{refund ? 'Prototype' : 'Opening soon'}</Stamp>
        </div>
      </header>

      {refund ? (
        <RefundCard onOpen={onOpenRun} />
      ) : (
        <section className="mx-5 border-y border-line py-5">
          <Label>Chapter 1 · The Refund</Label>
          <p className="mt-2 text-[15px] text-paper/85">The agency&apos;s first case is still being written up. Check back soon.</p>
        </section>
      )}

      <p className="mt-8 px-5 text-xs text-dim">All projects, people and accounts are fictional. Cases show how scams are caught, never how to run one.</p>
    </div>
  )
}
