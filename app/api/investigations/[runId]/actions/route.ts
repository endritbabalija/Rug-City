import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readJson } from '@/lib/investigation/request'
import { act, requireRefund } from '@/lib/investigation/service'
import { authenticate, route } from '@/lib/server'

const id = z.string().min(1).max(40)
const ids = z.array(id).max(12)

const Action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open_case') }),
  z.object({ type: z.literal('open_topic'), topic: id }),
  z.object({ type: z.literal('follow_lead'), lead: id }),
  z.object({ type: z.literal('submit_finding'), claim: id, evidence: ids.min(1) }),
  z.object({ type: z.literal('confront'), challenge: id, evidence: ids, findings: ids }),
  z.object({ type: z.literal('request_hint'), step: id }),
  z.object({
    type: z.literal('accuse'),
    suspect: id,
    slots: z.record(id, ids).refine((s) => Object.keys(s).length <= 6),
    activeMs: z.number().int().min(0).max(86_400_000).optional(),
  }),
  z.object({ type: z.literal('evidence_opened'), evidence: id }),
])

/** One player action. Returns the new projection and what happened. */
export const POST = route<{ params: Promise<{ runId: string }> }>(async (req, { params }) => {
  const { player } = await authenticate(req)
  await requireRefund()
  const { runId } = await params
  const action = Action.parse(await readJson(req))
  return NextResponse.json(await act(player.id, runId, action))
})
