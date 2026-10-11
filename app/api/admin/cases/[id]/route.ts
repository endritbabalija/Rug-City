import { NextResponse } from 'next/server'
import { z } from 'zod'
import { approveCase, rejectCase, storedCase } from '@/lib/cases/admin'
import { createPlaytest } from '@/lib/rooms'
import { authenticateAdmin, route } from '@/lib/server'

type Ctx = { params: Promise<{ id: string }> }

const Id = z.string().min(1).max(64)

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), releaseAt: z.number().int().positive(), targetSec: z.number().int().min(60).max(7200) }),
  z.object({ action: z.literal('reject'), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal('playtest') }),
])

/** One stored case in full, answers and solver report included. Admins only. */
export const GET = route<Ctx>(async (req, { params }) => {
  await authenticateAdmin(req)
  return NextResponse.json({ case: await storedCase(Id.parse((await params).id)) })
})

/** Approve, reject, or start a free playtest room. Admins only. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { player } = await authenticateAdmin(req)
  const id = Id.parse((await params).id)
  const body = Action.parse(await req.json())
  switch (body.action) {
    case 'approve':
      return NextResponse.json({ case: await approveCase(id, body) })
    case 'reject':
      return NextResponse.json({ case: await rejectCase(id, body.reason) })
    case 'playtest':
      return NextResponse.json({ code: await createPlaytest(player, id) })
  }
})
