import { NextResponse } from 'next/server'
import { normalizeCode, viewRoom } from '@/lib/rooms'
import { authenticateId, route } from '@/lib/server'

type Ctx = { params: Promise<{ code: string }> }

// Polled by every open room, so it skips loading the player.
export const GET = route<Ctx>(async (req, { params }) => {
  const id = authenticateId(req)
  const code = normalizeCode((await params).code)
  return NextResponse.json(await viewRoom(code, { id }))
})
