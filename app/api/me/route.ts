import { NextResponse } from 'next/server'
import { z } from 'zod'
import { track } from '@/lib/analytics'
import { caseSummaries } from '@/lib/cases'
import { badgeInfo, BADGES, SKUS } from '@/lib/catalog'
import { GameError } from '@/lib/game/engine'
import type { Player } from '@/lib/player'
import { authenticate, publicPlayer, route } from '@/lib/server'
import { store } from '@/lib/store'

export const GET = route(async (req) => {
  const { player, init } = await authenticate(req)
  track('app_open', player.id, { startParam: init?.startParam ?? null })
  return NextResponse.json({
    player: publicPlayer(player),
    startParam: init?.startParam ?? null,
    cases: caseSummaries(),
    skus: SKUS,
    badges: badgeMap(player),
  })
})

/** Shop badges plus any season badges this player has earned. */
function badgeMap(p: Player) {
  const map = { ...BADGES }
  for (const id of p.badges) {
    const info = badgeInfo(id)
    if (info) map[id] = info
  }
  return map
}

const Body = z.object({ activeBadge: z.string().nullable() })

export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  const { activeBadge } = Body.parse(await req.json())
  if (activeBadge && (!player.badges.includes(activeBadge) || !badgeInfo(activeBadge))) throw new GameError('NOT_OWNED', "You don't own that badge.", 403)
  const updated = await store().updatePlayer(player.id, (p) => ({ ...p, activeBadge: activeBadge ?? undefined }))
  return NextResponse.json({ player: publicPlayer(updated) })
})
