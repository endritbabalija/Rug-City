import { NextResponse } from 'next/server'
import { z } from 'zod'
import { track } from '@/lib/analytics'
import { caseBoard } from '@/lib/cases'
import { badgeInfo, BADGES, SKUS } from '@/lib/catalog'
import { flag } from '@/lib/flags'
import { GameError } from '@/lib/game/engine'
import { authenticate, publicPlayer, route } from '@/lib/server'
import { store } from '@/lib/store'

export const GET = route(async (req) => {
  const { player, init } = await authenticate(req)
  track('app_open', player.id, { startParam: init?.startParam ?? null })
  const [pub, board, seasonBanner, solo, dexCrew, districts] = await Promise.all([
    publicPlayer(player),
    store()
      .playedCaseIds(player.id)
      .then((played) => caseBoard(player, played)),
    flag('season_banner'),
    flag('solo'),
    flag('dex_crew'),
    flag('districts'),
  ])
  return NextResponse.json({
    player: pub,
    startParam: init?.startParam ?? null,
    ...board,
    skus: SKUS,
    badges: badgeMap(pub.badges),
    flags: { season_banner: seasonBanner, solo, dex_crew: dexCrew, districts },
  })
})

/** Shop badges plus any season badges this player has earned. */
function badgeMap(owned: string[]) {
  const map = { ...BADGES }
  for (const id of owned) {
    const info = badgeInfo(id)
    if (info) map[id] = info
  }
  return map
}

const Body = z.object({ activeBadge: z.string().nullable() })

export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  const { activeBadge } = Body.parse(await req.json())
  if (activeBadge && (!(await store().getBadges(player.id)).includes(activeBadge) || !badgeInfo(activeBadge)))
    throw new GameError('NOT_OWNED', "You don't own that badge.", 403)
  const updated = await store().updatePlayer(player.id, (p) => ({ ...p, activeBadge: activeBadge ?? undefined }))
  return NextResponse.json({ player: await publicPlayer(updated) })
})
