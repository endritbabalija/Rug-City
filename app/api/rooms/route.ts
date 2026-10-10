import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRoom } from '@/lib/rooms'
import { authenticate, route } from '@/lib/server'

const Body = z.object({ caseId: z.string().max(64) })

export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  const { caseId } = Body.parse(await req.json())
  const code = await createRoom(player, caseId)
  return NextResponse.json({ code })
})
