import { NextResponse } from 'next/server'
import { getRunView, requireRefund } from '@/lib/investigation/service'
import { authenticate, route } from '@/lib/server'

/** The run's projection. Never advances the story. */
export const GET = route<{ params: Promise<{ runId: string }> }>(async (req, { params }) => {
  const { player } = await authenticate(req)
  await requireRefund()
  const { runId } = await params
  return NextResponse.json({ run: await getRunView(player.id, runId) })
})
