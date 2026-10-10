import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ask, normalizeCode, viewRoom } from '@/lib/rooms'
import { authenticate, route } from '@/lib/server'

type Ctx = { params: Promise<{ code: string }> }

const Body = z.object({ suspectId: z.string().min(1).max(40), text: z.string().trim().min(1).max(300) })

export const POST = route<Ctx>(async (req, { params }) => {
  const { player } = await authenticate(req)
  const code = normalizeCode((await params).code)
  const { suspectId, text } = Body.parse(await req.json())
  await ask(code, player, suspectId, text)
  return NextResponse.json({ room: await viewRoom(code, player) })
})
