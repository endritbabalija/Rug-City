'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/client/api'
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

const POLL_MS = 4000

export function useRoom(code: string, onPlayer: (p: PublicPlayer) => void) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the request resolves
    void refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)

    const rt = realtimeClient()
    const channel = rt?.channel(`room:${code}`).on('broadcast', { event: 'update' }, () => void refresh()).subscribe()

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) void rt?.removeChannel(channel)
    }
  }, [code, refresh])

  const now = useCallback(() => Date.now() + clockOffset.current, [])

  return { room, error, refresh, act, ask, now }
}
