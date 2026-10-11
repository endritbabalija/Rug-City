import { NextResponse } from 'next/server'
import { z } from 'zod'
import { flag } from '@/lib/flags'
import { GameError } from '@/lib/game/engine'
import { createSolo } from '@/lib/rooms'
import { authenticate, route } from '@/lib/server'

const Body = z.object({ caseId: z.string().max(64) })

export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  const { caseId } = Body.parse(await req.json())
  if (!(await flag('solo'))) throw new GameError('NOT_AVAILABLE', 'Solo cases are not open yet.', 404)
  const code = await createSolo(player, caseId)
  return NextResponse.json({ code })
})
