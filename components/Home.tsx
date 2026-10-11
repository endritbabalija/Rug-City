'use client'

import type { PublicPlayer } from '@/lib/server'
import { Label, Stamp, Tape } from './ui'

/** Placeholder until The Refund (Rug City — The Refund Brief.md) adds its entry card here. */
export function Home({ player }: { player: PublicPlayer }) {
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
          <Stamp className="text-lg">Opening soon</Stamp>
        </div>
      </header>

      <section className="mx-5 border-y border-line py-5">
        <Label>Chapter 1 · The Refund</Label>
        <p className="mt-2 text-[15px] text-paper/85">The agency&apos;s first case is still being written up. Check back soon.</p>
      </section>

      <p className="mt-8 px-5 text-xs text-dim">All projects, people and accounts are fictional. Cases show how scams are caught, never how to run one.</p>
    </div>
  )
}
