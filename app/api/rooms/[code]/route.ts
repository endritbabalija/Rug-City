import { NextResponse } from 'next/server'
import { normalizeCode, viewRoom } from '@/lib/rooms'
import { authenticate, route } from '@/lib/server'

type Ctx = { params: Promise<{ code: string }> }

export const GET = route<Ctx>(async (req, { params }) => {
  const { player } = await authenticate(req)
  const code = normalizeCode((await params).code)
  return NextResponse.json(await viewRoom(code, player))
})
