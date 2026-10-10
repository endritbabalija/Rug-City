'use client'

import type { Clue } from '@/lib/cases/types'

export function ClueCard({ clue, index }: { clue: Clue; index: number }) {
  const b = clue.body
  return (
    <article className="paper relative animate-rise rounded-sm p-4 pt-5" style={{ animationDelay: `${index * 70}ms`, rotate: `${(((index * 37) % 5) - 2) * 0.4}deg` }}>
      <div className="absolute -top-2 left-5 h-5 w-16 rotate-[-3deg] bg-tape/80 shadow-sm" aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl leading-tight font-black uppercase">{clue.title}</h3>
        <span className="shrink-0 font-mono text-[10px] text-paper-ink/50">EXHIBIT {clue.id.toUpperCase()}</span>
      </div>
      <div className="mb-3 font-type text-[11px] tracking-wider text-rug uppercase">{clue.source}</div>

      {b.kind === 'chat' && (
        <div className="space-y-2 rounded-sm bg-paper-2/70 p-3">
          <div className="font-mono text-[11px] text-paper-ink/60">{b.channel}</div>
          {b.lines.map((l, i) => (
            <div key={i} className={l.deleted ? 'line-through opacity-60' : ''}>
              <div className="font-mono text-[10px] text-paper-ink/50">
                {l.from} · {l.at}
              </div>
              <div className="font-type text-[15px] leading-snug">{l.text}</div>
            </div>
          ))}
        </div>
      )}

      {b.kind === 'post' && (
        <div className="rounded-sm border border-paper-ink/15 bg-white/40 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold">{b.author}</span>
            <span className="font-mono text-[10px] text-paper-ink/50">{b.at}</span>
          </div>
          <div className="font-mono text-[11px] text-paper-ink/60">{b.handle}</div>
          <p className="mt-2 text-[15px] leading-snug">{b.text}</p>
          {b.editedFrom && <p className="mt-2 font-type text-xs text-paper-ink/60">Edited. Original: “{b.editedFrom}”</p>}
          <div className="mt-2 flex gap-3 font-mono text-[10px] text-paper-ink/50">
            {b.stats && <span>{b.stats}</span>}
            {b.deleted && <span className="font-bold text-rug">DELETED · ARCHIVED COPY</span>}
          </div>
        </div>
      )}

      {b.kind === 'code' && (
        <div className="overflow-hidden rounded-sm bg-ink text-paper">
          <div className="border-b border-line px-3 py-2 font-mono text-[11px] text-dim">
            {b.repo} · <span className="text-tape">{b.commit}</span> · {b.author} · {b.at}
            <div className="text-paper">“{b.message}”</div>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed">
            {b.diff.map((line, i) => (
              <div key={i} className={line.startsWith('+') ? 'text-ok' : line.startsWith('-') ? 'text-rug' : 'text-dim'}>
                {line || ' '}
              </div>
            ))}
          </pre>
        </div>
      )}

      {b.kind === 'multisig' && (
        <div className="rounded-sm bg-paper-2/70 p-3 font-type text-sm">
          <div className="font-mono text-[11px] text-paper-ink/60">
            {b.wallet} · {b.at}
          </div>
          <p className="mt-1 font-bold">{b.proposal}</p>
          <table className="mt-2 w-full text-left">
            <tbody>
              {b.votes.map((v) => (
                <tr key={v.signer} className="border-t border-dashed border-paper-ink/20">
                  <td className="py-1">{v.signer}</td>
                  <td className={`py-1 text-right font-bold uppercase ${v.vote === 'yes' ? 'text-ok' : v.vote === 'no' ? 'text-rug' : 'text-paper-ink/50'}`}>{v.vote}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {b.note && <p className="mt-2 text-[13px] italic">{b.note}</p>}
        </div>
      )}

      {b.kind === 'doc' && (
        <div className="font-type text-[14.5px] leading-snug">
          <p className="mb-2 font-bold underline decoration-dotted underline-offset-4">{b.heading}</p>
          <ul className="space-y-1">
            {b.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          {b.footer && <p className="mt-3 text-[11px] text-paper-ink/60">{b.footer}</p>}
        </div>
      )}
    </article>
  )
}
