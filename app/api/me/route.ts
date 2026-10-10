import { NextResponse } from 'next/server'
import { z } from 'zod'
import { caseSummaries } from '@/lib/cases'
import { BADGES, SKUS } from '@/lib/catalog'
import { GameError } from '@/lib/game/engine'
import { authenticate, publicPlayer, route } from '@/lib/server'
import { store } from '@/lib/store'

export const GET = route(async (req) => {
  const { player, init } = await authenticate(req)
  return NextResponse.json({
    player: publicPlayer(player),
    startParam: init?.startParam ?? null,
    cases: caseSummaries(),
    skus: SKUS,
    badges: BADGES,
  })
})

const Body = z.object({ activeBadge: z.string().nullable() })

export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  const { activeBadge } = Body.parse(await req.json())
  if (activeBadge && !player.badges.includes(activeBadge)) throw new GameError('NOT_OWNED', "You don't own that badge.", 403)
  const updated = await store().updatePlayer(player.id, (p) => ({ ...p, activeBadge: activeBadge ?? undefined }))
  return NextResponse.json({ player: publicPlayer(updated) })
})
