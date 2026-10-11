import { NextResponse } from 'next/server'
import { z } from 'zod'
import { latestRun, requireRefund, startRun } from '@/lib/investigation/service'
import { readJson } from '@/lib/investigation/request'
import { authenticate, route } from '@/lib/server'

const caseId = z.string().min(1).max(40)

/** The player's latest run of a case, or null. Read-only. */
export const GET = route(async (req) => {
  const { player } = await authenticate(req)
  await requireRefund()
  const id = caseId.parse(new URL(req.url).searchParams.get('case'))
  return NextResponse.json({ run: await latestRun(player.id, id) })
})

const Start = z.object({ caseId, restart: z.boolean().optional() })

/** Resume the latest run, or start one. `restart: true` starts a new, separate run. */
export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  await requireRefund()
  const body = Start.parse(await readJson(req))
  return NextResponse.json({ run: await startRun(player.id, body.caseId, body.restart ?? false) })
})
