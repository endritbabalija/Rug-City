import { NextResponse } from 'next/server'
import { track } from '@/lib/analytics'
import { authenticate, publicPlayer, route } from '@/lib/server'

export const GET = route(async (req) => {
  const { player, init } = await authenticate(req)
  track('app_open', player.id, { startParam: init?.startParam ?? null })
  return NextResponse.json({ player: publicPlayer(player) })
})
