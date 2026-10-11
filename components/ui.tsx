'use client'

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { haptic } from '@/lib/telegram/webapp'

type Variant = 'primary' | 'ghost' | 'paper' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-tape text-ink shadow-[0_4px_0_#9c7a12] active:translate-y-[3px] active:shadow-[0_1px_0_#9c7a12]',
  ghost: 'border border-line text-paper bg-ink-2 active:bg-ink-3',
  paper: 'paper text-paper-ink active:brightness-95',
  danger: 'bg-rug text-paper shadow-[0_4px_0_#8a2213] active:translate-y-[3px] active:shadow-[0_1px_0_#8a2213]',
}

export function Button({
  variant = 'primary',
  busy,
  className = '',
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      onClick={(e) => {
        haptic.tap()
        onClick?.(e)
      }}
      className={`relative inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 font-display text-xl font-bold uppercase tracking-wide transition disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
    >
      <span className={busy ? 'opacity-0' : ''}>{children}</span>
      {busy && <span className="absolute inset-0 grid place-items-center text-base">● ● ●</span>}
    </button>
  )
}

export function Tape({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`tape flex h-7 items-center overflow-hidden ${className}`}>
      {children && (
        <span className="mx-auto bg-tape px-3 font-display text-sm font-black uppercase tracking-[0.25em] text-ink">{children}</span>
      )}
    </div>
  )
}

export function Stamp({ children, tone = 'rug', className = '' }: { children: ReactNode; tone?: 'rug' | 'ok' | 'paper'; className?: string }) {
  const color = tone === 'rug' ? 'text-rug' : tone === 'ok' ? 'text-ok' : 'text-paper'
  return <span className={`stamp animate-stamp ${color} ${className}`}>{children}</span>
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`font-display text-sm font-bold uppercase tracking-[0.2em] text-dim ${className}`}>{children}</div>
}

export function Pill({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'tape' | 'rug' | 'ok' }) {
  const tones = {
    dim: 'border-line text-dim',
    tape: 'border-tape/60 text-tape',
    rug: 'border-rug/60 text-rug',
    ok: 'border-ok/60 text-ok',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

/** Re-renders every second and returns the (server-adjusted) time, for screens that change when a timer runs out. */
export function useClock(now: () => number) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return now()
}

/** `m:ss` until `endsAt`, 0:00 once it has passed. */
export function timeLeft(endsAt: number, at: number) {
  const left = Math.max(0, endsAt - at)
  return `${Math.floor(left / 60000)}:${Math.floor((left % 60000) / 1000).toString().padStart(2, '0')}`
}

/** `ended` replaces the countdown once it reaches zero. */
export function Countdown({ endsAt, now, label, ended }: { endsAt: number; now: () => number; label: string; ended?: string }) {
  const at = useClock(now)
  const left = Math.max(0, endsAt - at)
  if (left === 0 && ended) return <div className="py-1 font-mono text-xs font-semibold text-rug">{ended}</div>
  const urgent = left < 60000
  return (
    <div className={`flex items-baseline gap-2 font-mono text-sm ${urgent ? 'animate-flicker text-rug' : 'text-tape'}`}>
      <span className="text-[10px] uppercase tracking-widest text-dim">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{left === 0 ? 'OVERTIME' : timeLeft(endsAt, at)}</span>
    </div>
  )
}

/** An inline "are you sure?" box: the pattern for anything that costs Stars, points or a player's case. */
export function Confirm({
  children,
  yes,
  onYes,
  onNo,
  busy,
}: {
  children: ReactNode
  yes: string
  onYes: () => void
  onNo: () => void
  busy?: boolean
}) {
  return (
    <div className="rounded-md border border-rug/60 bg-ink-2 p-3 text-left">
      <p className="font-sans text-sm normal-case text-paper/85">{children}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" className="flex-1" busy={busy} onClick={onYes}>
          {yes}
        </Button>
        <Button variant="ghost" onClick={onNo}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={onClose}>
      <div className="safe-bottom max-h-[85dvh] w-full animate-rise overflow-y-auto rounded-t-2xl border-t border-line bg-ink-2 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-black uppercase">{title}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-full border border-line text-dim" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
