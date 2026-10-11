'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
import { pollMs } from '@/lib/client/sync'
import type { RoomView } from '@/lib/game/view'
import type { PublicPlayer } from '@/lib/server'

export type RoomData = RoomView & { member: boolean; minPlayers: number }

let realtime: SupabaseClient | null | undefined
function realtimeClient() {
  if (realtime === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    realtime = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  }
  return realtime
}

export function useRoom(code: string, onPlayer: (p: PublicPlayer) => void) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [live, setLive] = useState(false)
  const clockOffset = useRef(0)
  const inflight = useRef(false)

  const accept = useCallback((r: RoomData) => {
    clockOffset.current = r.serverNow - Date.now()
    setRoom(r)
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    try {
      accept(await api<RoomData>(`/api/rooms/${code}`))
    } catch (e) {
      if (e instanceof ApiError) setError(e)
    } finally {
      inflight.current = false
    }
  }, [code, accept])

  /** Send an action; the response carries the fresh room and player. Errors are rethrown for toasts. */
  const act = useCallback(
    async (action: Record<string, unknown>) => {
      const res = await api<{ room: RoomData; player: PublicPlayer }>(`/api/rooms/${code}/action`, action)
      accept(res.room)
      onPlayer(res.player)
      return res
    },
    [code, accept, onPlayer],
  )

  const ask = useCallback(
    async (suspectId: string, text: string) => {
      const res = await api<{ room: RoomData }>(`/api/rooms/${code}/chat`, { suspectId, text })
      accept(res.room)
    },
    [code, accept],
  )

  const mode = room?.mode

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the request resolves
    void refresh()
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // Crew rooms listen for Realtime pushes. Solo rooms only change through this player's own actions.
  useEffect(() => {
    if (mode !== 'crew') return
    const rt = realtimeClient()
    const channel = rt
      ?.channel(`room:${code}`)
      .on('broadcast', { event: 'update' }, () => void refresh())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      setLive(false)
      if (channel) void rt?.removeChannel(channel)
    }
  }, [code, mode, refresh])

  // Until the first fetch lands (or if it failed), keep retrying like a crew room without Realtime.
  useEffect(() => {
    const ms = pollMs(mode ?? 'crew', live)
    if (ms === null) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, ms)
    return () => clearInterval(timer)
  }, [mode, live, refresh])

  const now = useCallback(() => Date.now() + clockOffset.current, [])

  return { room, error, refresh, act, ask, now }
}
