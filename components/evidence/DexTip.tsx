'use client'

import { useEffect } from 'react'
import type { TutorialStep } from '@/lib/game/types'
import type { PhaseProps } from '../Room'

/**
 * Dex's tutorial tip for one step, at the top of that step's screen. Showing it marks the step
 * reached; a step reached before this visit, or dismissed, doesn't show again here (it stays in
 * the Dex panel). Renders nothing outside tutorial rooms.
 */
export function DexTip({ step, room, tips, className = '' }: Pick<PhaseProps, 'room' | 'tips'> & { step: TutorialStep; className?: string }) {
  const { reach } = tips
  const tutorial = !!room.tutorial
  useEffect(() => {
    if (tutorial) reach(step)
  }, [tutorial, reach, step])

  if (!room.tutorial || !tips.show(step)) return null
  return (
    <div className={`paper animate-rise rounded-lg rounded-bl-sm px-3.5 py-2.5 font-type text-[15px] leading-snug ${className}`}>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold text-rug">
        <span>🕵️ DEX · TIP</span>
        <button onClick={() => tips.dismiss(step)} className="font-mono text-[11px] text-paper-ink/60 underline underline-offset-2">
          Got it
        </button>
      </div>
      {room.tutorial.tips[step]}
    </div>
  )
}
