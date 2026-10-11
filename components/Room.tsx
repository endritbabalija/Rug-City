'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRoom, type RoomData } from '@/hooks/useRoom'
import { ApiError, isTelegram } from '@/lib/client/api'
import type { TutorialStep } from '@/lib/game/types'
import { forgetRoom, rememberRoom } from '@/lib/client/lastRoom'
import { bindBackButton, canFullscreen, onFullscreenChange, setClosingConfirmation, setFullscreen, webApp } from '@/lib/telegram/webapp'
import { Accuse } from './phases/Accuse'
import { Briefing } from './phases/Briefing'
import { Investigate } from './phases/Investigate'
import { Lobby } from './phases/Lobby'
import { Reveal } from './phases/Reveal'
import { useGame } from './GameContext'
import { Button, Sheet, Tape } from './ui'

export interface PhaseProps {
  room: RoomData
  /** Run a room action with busy state and error toasts. Resolves false on failure. */
  run: (action: Record<string, unknown>, key?: string) => Promise<boolean>
  busy: string | null
  ask: (suspectId: string, text: string) => Promise<void>
  now: () => number
  tips: TipProps
}

/** Dex's tutorial tips (tutorial rooms only; see DexTip). */
export interface TipProps {
  /** Tell the server the player reached this step. Sent once per step; failures are ignored. */
  reach: (step: TutorialStep) => void
  /** Whether the step's tip shows on its screen: not reached before this visit, and not dismissed. */
  show: (step: TutorialStep) => boolean
  dismiss: (step: TutorialStep) => void
}

const PHASE_LABEL: Record<RoomData['phase'], string> = {
  lobby: 'Lobby',
  briefing: 'Briefing',
  investigate: 'Investigation',
  accuse: 'Accusation',
  reveal: 'Verdict',
}

/** Shareable link that opens this room: the Mini App direct link inside Telegram, ?room= in dev. */
export function inviteLink(code: string) {
  const bot = process.env.NEXT_PUBLIC_BOT_USERNAME
  const app = process.env.NEXT_PUBLIC_APP_SHORT_NAME
  if (bot && app) return `https://t.me/${bot}/${app}?startapp=${code}`
  return `${window.location.origin}/?room=${code}`
}

export function Room({ code }: { code: string }) {
  const { go, toast, setPlayer } = useGame()
  const { room, error, act, ask, now } = useRoom(code, setPlayer)
  const [busy, setBusy] = useState<string | null>(null)
  const [fullscreen, setFs] = useState(() => !!webApp()?.isFullscreen)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const joinTried = useRef(false)
  const tipsSent = useRef(new Set<TutorialStep>())
  // Steps reached before this visit (taken from the first load) or dismissed since: their tips stay hidden.
  const [hiddenTips, setHiddenTips] = useState<Set<TutorialStep> | null>(null)
  if (room && hiddenTips === null) setHiddenTips(new Set(room.tutorial?.reached.map((r) => r.step)))
  const lastPhase = useRef<string | null>(null)
  const live = !!room && room.member && room.phase !== 'lobby' && room.phase !== 'reveal'
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
  }, [live])

  // Mid-case, going back asks first: the case keeps running without you.
  const back = useCallback(() => (liveRef.current ? setConfirmLeave(true) : go({ name: 'home' })), [go])
  useEffect(() => bindBackButton(back), [back])

  // Home offers a way back into a case in progress; a finished or closed case is forgotten.
  useEffect(() => {
    if (room?.member && room.phase !== 'reveal') rememberRoom(code)
    else if (room?.phase === 'reveal' || error?.code === 'NO_ROOM') forgetRoom(code)
  }, [code, room?.member, room?.phase, error?.code])

  const run = useCallback(
    async (action: Record<string, unknown>, key = String(action.type)) => {
      setBusy(key)
      try {
        await act(action)
        return true
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
        return false
      } finally {
        setBusy(null)
      }
    },
    [act, toast],
  )

  const reachedTips = room?.tutorial?.reached
  const tips = useMemo<TipProps>(
    () => ({
      reach: (step) => {
        if (tipsSent.current.has(step) || reachedTips?.some((r) => r.step === step)) return
        tipsSent.current.add(step)
        act({ type: 'tutorialStep', step }).catch(() => tipsSent.current.delete(step))
      },
      show: (step) => !!hiddenTips && !hiddenTips.has(step),
      dismiss: (step) => setHiddenTips((h) => new Set(h).add(step)),
    }),
    [act, reachedTips, hiddenTips],
  )

  // Opening a room link joins you automatically while the lobby is open.
  useEffect(() => {
    if (room && !room.member && room.phase === 'lobby' && !joinTried.current) {
      joinTried.current = true
      void run({ type: 'join' })
    }
  }, [room, run])

  useEffect(() => onFullscreenChange(setFs), [])

  // Go fullscreen when the case starts, and warn before closing mid-case.
  useEffect(() => {
    if (!room) return
    setClosingConfirmation(live)
    // Solo rooms open straight on the briefing.
    const opened = room.mode === 'solo' ? lastPhase.current === null : lastPhase.current === 'lobby'
    if (opened && room.phase === 'briefing') setFullscreen(true)
    lastPhase.current = room.phase
  }, [room, live])

  useEffect(() => () => setClosingConfirmation(false), [])

  if (error && !room) {
    return (
      <div className="grid min-h-[80dvh] place-items-center p-6 text-center">
        <div>
          <Tape className="mb-6">Case not found</Tape>
          <p className="font-display text-3xl font-black uppercase">{error.message}</p>
          <Button className="mt-6" variant="ghost" onClick={() => go({ name: 'home' })}>
            Back to cases
          </Button>
        </div>
      </div>
    )
  }

  if (!room) {
    return <p className="animate-flicker p-10 text-center font-display text-xl tracking-[0.3em] text-tape uppercase">Pulling case {code}…</p>
  }

  if (!room.member && room.phase !== 'lobby') {
    return (
      <div className="grid min-h-[80dvh] place-items-center p-6 text-center">
        <div>
          <Tape className="mb-6">Restricted</Tape>
          <p className="font-display text-3xl font-black uppercase">This crew already started without you.</p>
          <Button className="mt-6" onClick={() => go({ name: 'home' })}>
            Open your own case
          </Button>
        </div>
      </div>
    )
  }

  const props: PhaseProps = { room, run, busy, ask, now, tips }

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-ink/95 px-4 py-2 backdrop-blur">
        {!isTelegram() && (
          <button onClick={back} className="text-dim" aria-label="Back">
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight font-black uppercase">{room.case.title}</div>
          <div className="font-mono text-[11px] text-dim">
            CASE {room.code} · {PHASE_LABEL[room.phase].toUpperCase()}
          </div>
        </div>
        {canFullscreen() && (
          <button onClick={() => setFullscreen(!fullscreen)} className="rounded border border-line px-2 py-1 font-mono text-xs text-dim" aria-label="Toggle fullscreen">
            {fullscreen ? '⤡' : '⤢'}
          </button>
        )}
      </div>

      {room.phase === 'lobby' && <Lobby {...props} />}
      {room.phase === 'briefing' && <Briefing {...props} />}
      {room.phase === 'investigate' && <Investigate {...props} />}
      {room.phase === 'accuse' && <Accuse {...props} />}
      {room.phase === 'reveal' && <Reveal {...props} />}

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave the case?">
        <p className="text-[15px] text-paper/85">It keeps running and you can come back from Home.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => go({ name: 'home' })}>
            Leave
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
