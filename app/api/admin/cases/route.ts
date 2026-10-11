import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listStoredCases } from '@/lib/cases/admin'
import { authenticateAdmin, route } from '@/lib/server'

const Status = z.enum(['draft', 'review', 'live', 'retired'])

/** Stored cases with one status (default: in review). Admins only. */
export const GET = route(async (req) => {
  await authenticateAdmin(req)
  const status = Status.parse(new URL(req.url).searchParams.get('status') ?? 'review')
  return NextResponse.json({ cases: await listStoredCases(status) })
})
