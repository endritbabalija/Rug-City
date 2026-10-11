import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TUTORIAL_STEPS } from '@/lib/game/types'
import { act, normalizeCode, viewRoom } from '@/lib/rooms'
import { authenticate, publicPlayer, route } from '@/lib/server'
import { store } from '@/lib/store'

type Ctx = { params: Promise<{ code: string }> }

const Id = z.string().min(1).max(40)
const Action = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['join', 'leave', 'start', 'ready', 'skip', 'callVote', 'closeVote', 'hint', 'addDex', 'removeDex', 'invited']) }),
  z.object({ type: z.literal('vote'), vote: z.object({ culprit: Id, motive: Id, trail: Id }) }),
  z.object({ type: z.literal('trace'), walletId: Id }),
  z.object({ type: z.literal('subpoena'), suspectId: Id }),
  z.object({ type: z.literal('askDex'), ask: z.enum(['clue', 'hint']) }),
  z.object({ type: z.literal('tutorialStep'), step: z.enum(TUTORIAL_STEPS) }),
])

export const POST = route<Ctx>(async (req, { params }) => {
  const { player } = await authenticate(req)
  const code = normalizeCode((await params).code)
  const action = Action.parse(await req.json())
  await act(code, player, action)
  const fresh = (await store().getPlayer(player.id)) ?? player
  const [room, pub] = await Promise.all([viewRoom(code, fresh), publicPlayer(fresh)])
  return NextResponse.json({ room, player: pub })
})
