import { NextResponse } from 'next/server'
import { z } from 'zod'
import { seasonOf } from '@/lib/game/progress'
import { leaderboard } from '@/lib/season'
import { authenticate, route } from '@/lib/server'

const Query = z.object({ season: z.coerce.number().int().min(1).optional() })

export const GET = route(async (req) => {
  const { player } = await authenticate(req)
  const { season } = Query.parse({ season: new URL(req.url).searchParams.get('season') || undefined })
  return NextResponse.json(await leaderboard(player, Math.min(season ?? Infinity, seasonOf(Date.now()))))
})
