'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/client/api'
import { useGame } from '../GameContext'
import type { PhaseProps } from '../Room'
import { Button, Label } from '../ui'
import { SuspectCard } from './SuspectCard'

export function Interrogation({ room, run, busy, ask }: PhaseProps) {
  const { player, buy, toast } = useGame()
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const thread = active ? room.chats[active] : null
  const suspect = active ? room.case.suspects.find((s) => s.id === active) : null

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages.length, sending])

  async function send() {
    const text = draft.trim()
    if (!text || !active) return
    setSending(true)
    setDraft('')
    try {
      await ask(active, text)
    } catch (e) {
      setDraft(text)
      toast(e instanceof ApiError ? e.message : "They didn't answer. Try again.", 'error')
    } finally {
      setSending(false)
    }
  }

  async function subpoena() {
    if (!active) return
    if (player.items.subpoena <= 0 && !(await buy('subpoena'))) return
    if (await run({ type: 'subpoena', suspectId: active }, 'subpoena')) toast('Subpoena served. Their next answer must be the truth.', 'ok')
  }

  if (!active || !thread || !suspect) {
    return (
      <div className="px-4">
        <p className="text-sm text-dim">These suspects reached out to you privately. Your crew can&apos;t see these chats, so share what you learn.</p>
        <div className="mt-3 space-y-3">
          {room.mySuspects.map((id) => {
            const s = room.case.suspects.find((x) => x.id === id)!
            const unread = room.chats[id].messages.length
            return (
              <button key={id} className="block w-full text-left" onClick={() => setActive(id)}>
                <SuspectCard suspect={s} compact action={<span className="rounded-full bg-rug px-2 py-0.5 font-mono text-xs text-paper">{unread}</span>} />
              </button>
            )
          })}
        </div>
        <Label className="mt-6">Questions left</Label>
        <p className="font-mono text-2xl text-tape">{room.questionsLeft}</p>
      </div>
    )
  }

  const waiting = sending || thread.messages.at(-1)?.from === 'player'

  return (
    <div className="flex h-[calc(100dvh-178px)] flex-col px-4">
      <button onClick={() => setActive(null)} className="mb-2 self-start font-display text-sm font-bold tracking-widest text-dim uppercase">
        ← All suspects
      </button>
      <SuspectCard suspect={suspect} compact />

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pb-3">
        {thread.messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'player' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] animate-rise rounded-lg px-3.5 py-2.5 text-[15px] leading-snug ${
                m.from === 'player' ? 'rounded-br-sm bg-tape text-ink' : 'paper rounded-bl-sm font-type'
              } ${m.subpoena && m.from === 'suspect' ? 'ring-2 ring-rug' : ''}`}
            >
              {m.subpoena && m.from === 'suspect' && <div className="mb-1 font-mono text-[10px] font-bold text-rug">⚖️ UNDER SUBPOENA</div>}
              {m.text}
            </div>
          </div>
        ))}
        {waiting && <div className="animate-flicker font-mono text-xs text-dim">{suspect.name} is typing…</div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between font-mono text-xs">
          <span className={room.questionsLeft === 0 ? 'text-rug' : 'text-dim'}>{room.questionsLeft} questions left</span>
          {thread.subpoenaArmed ? (
            <span className="font-bold text-rug">⚖️ Subpoena armed</span>
          ) : (
            <button onClick={subpoena} disabled={busy === 'subpoena'} className="text-tape underline underline-offset-2">
              ⚖️ Subpoena {player.items.subpoena > 0 ? `(${player.items.subpoena})` : '· ⭐25'}
            </button>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 300))}
            placeholder={room.questionsLeft === 0 && !thread.subpoenaArmed ? 'Out of questions' : `Ask ${suspect.name.split(' ')[0]}…`}
            disabled={waiting || (room.questionsLeft === 0 && !thread.subpoenaArmed)}
            className="min-h-12 flex-1 rounded-md border border-line bg-ink-2 px-3 text-[15px] focus:border-tape focus:outline-none disabled:opacity-50"
          />
          <Button type="submit" className="px-4" disabled={!draft.trim() || waiting}>
            Ask
          </Button>
        </form>
      </div>
    </div>
  )
}
