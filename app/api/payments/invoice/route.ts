import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createInvoice } from '@/lib/payments'
import { authenticate, route } from '@/lib/server'

const Body = z.object({ sku: z.string().max(40) })

export const POST = route(async (req) => {
  const { player } = await authenticate(req)
  const { sku } = Body.parse(await req.json())
  return NextResponse.json(await createInvoice(player, sku))
})
