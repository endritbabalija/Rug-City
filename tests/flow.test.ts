import { beforeEach, describe, expect, it, vi } from 'vitest'

// Exercise the server services end to end against the in-memory store, with Telegram mocked.
const botCalls: { method: string; body: Record<string, unknown> }[] = []
vi.mock('@/lib/telegram/bot-api', () => ({
  botApi: vi.fn(async (method: string, body: Record<string, unknown>) => {
    botCalls.push({ method, body })
    return method === 'createInvoiceLink' ? 'https://t.me/$invoice' : true
  }),
  miniAppLink: () => 'https://t.me/bot/app',
}))

process.env.TELEGRAM_BOT_TOKEN = 'test-token'
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.ANTHROPIC_API_KEY

const { store } = await import('@/lib/store')
const rooms = await import('@/lib/rooms')
const payments = await import('@/lib/payments')
const { newPlayer } = await import('@/lib/player')

async function mkPlayer(id: number, referredBy?: number) {
  return store().createPlayer(newPlayer({ id, name: `P${id}` }, Date.now(), referredBy))
}
const fresh = async (id: number) => (await store().getPlayer(id))!

async function lobbyWith(hostId: number, others: number[]) {
  const code = await rooms.createRoom(await fresh(hostId), 'mooncat-exit')
  for (const id of others) await rooms.act(code, await fresh(id), { type: 'join' })
  return code
}

let nextId = 100
const ids = (n: number) => Array.from({ length: n }, () => nextId++)

beforeEach(() => {
  botCalls.length = 0
})

describe('hosting costs', () => {
  it('uses the daily free case, then credits, and refuses without charging when out', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)

    await rooms.act(await lobbyWith(host, [a, b]), await fresh(host), { type: 'start' })
    expect((await fresh(host)).freeCaseDay).toBeDefined()

    const second = await lobbyWith(host, [a, b])
    await expect(rooms.act(second, await fresh(host), { type: 'start' })).rejects.toMatchObject({ code: 'NO_CASES' })

    await store().updatePlayer(host, (p) => ({ ...p, caseCredits: 1 }))
    await rooms.act(second, await fresh(host), { type: 'start' })
    expect((await fresh(host)).caseCredits).toBe(0)
  })

  it('does not charge when the start itself is invalid', async () => {
    const [host, a] = ids(2)
    for (const id of [host, a]) await mkPlayer(id)
    const code = await lobbyWith(host, [a])
    await expect(rooms.act(code, await fresh(host), { type: 'start' })).rejects.toMatchObject({ code: 'NOT_ENOUGH_PLAYERS' })
    expect((await fresh(host)).freeCaseDay).toBeUndefined()
  })
})

describe('power-ups', () => {
  it('spends an item on success and keeps it when the action is rejected', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await rooms.act(code, await fresh(host), { type: 'skip' })

    await store().updatePlayer(a, (p) => ({ ...p, items: { ...p.items, trace: 2 } }))
    await rooms.act(code, await fresh(a), { type: 'trace', walletId: 'fw1' })
    expect((await fresh(a)).items.trace).toBe(1)
    await expect(rooms.act(code, await fresh(a), { type: 'trace', walletId: 'fw1' })).rejects.toMatchObject({ code: 'ALREADY_KNOWN' })
    expect((await fresh(a)).items.trace).toBe(1)

    await expect(rooms.act(code, await fresh(b), { type: 'hint' })).rejects.toMatchObject({ code: 'NO_ITEM' })
  })

  it('answers suspects from the script when no AI key is set', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await rooms.act(code, await fresh(host), { type: 'skip' })
    const view = await rooms.viewRoom(code, await fresh(a))
    const suspect = view.mySuspects[0]
    const after = await rooms.ask(code, await fresh(a), suspect, 'Where were you at 3am?')
    const thread = after.chats[`${a}:${suspect}`]
    expect(thread.map((m) => m.from)).toEqual(['player', 'suspect'])
    expect(thread[1].text.length).toBeGreaterThan(0)
  })
})

describe('referrals', () => {
  it('gives the inviter and the new player a case once the new player finishes a case', async () => {
    const [host, a, b] = ids(3)
    await mkPlayer(host)
    await mkPlayer(a, host)
    await mkPlayer(b)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await rooms.act(code, await fresh(host), { type: 'skip' })
    await rooms.act(code, await fresh(host), { type: 'callVote' })
    const vote = { culprit: 'brad', motive: 'margin', trail: 'exchange' }
    for (const id of [host, a, b]) await rooms.act(code, await fresh(id), { type: 'vote', vote })

    expect((await fresh(a)).caseCredits).toBe(1)
    expect((await fresh(host)).caseCredits).toBe(1)
    expect((await fresh(b)).caseCredits).toBe(0)

    // The case is over, so nothing can settle it a second time.
    await expect(rooms.act(code, await fresh(host), { type: 'closeVote' })).rejects.toMatchObject({ code: 'WRONG_PHASE' })
    expect((await fresh(host)).caseCredits).toBe(1)
  })
})

describe('Stars payments', () => {
  it('creates an XTR invoice, validates pre-checkout, and grants exactly once', async () => {
    const [buyer] = ids(1)
    await mkPlayer(buyer)
    const res = await payments.createInvoice(await fresh(buyer), 'subpoena')
    expect(res).toEqual({ link: 'https://t.me/$invoice' })
    const invoice = botCalls.find((c) => c.method === 'createInvoiceLink')!.body
    expect(invoice.currency).toBe('XTR')
    expect(invoice.prices).toEqual([{ label: 'Subpoena', amount: 25 }])
    const purchaseId = invoice.payload as string

    await payments.handlePreCheckout({ id: 'q1', from: { id: buyer }, currency: 'XTR', total_amount: 25, invoice_payload: purchaseId })
    expect(botCalls.at(-1)).toMatchObject({ method: 'answerPreCheckoutQuery', body: { ok: true } })

    await payments.handlePreCheckout({ id: 'q2', from: { id: buyer }, currency: 'XTR', total_amount: 1, invoice_payload: purchaseId })
    expect(botCalls.at(-1)).toMatchObject({ method: 'answerPreCheckoutQuery', body: { ok: false } })

    await payments.handlePreCheckout({ id: 'q3', from: { id: 999 }, currency: 'XTR', total_amount: 25, invoice_payload: purchaseId })
    expect(botCalls.at(-1)).toMatchObject({ body: { ok: false } })

    const pay = { currency: 'XTR', total_amount: 25, invoice_payload: purchaseId, telegram_payment_charge_id: 'ch_1' }
    expect(await payments.handleSuccessfulPayment(buyer, pay)).not.toBeNull()
    expect(await payments.handleSuccessfulPayment(buyer, pay)).toBeNull()
    expect((await fresh(buyer)).items.subpoena).toBe(1)

    await payments.refundCharge('ch_1')
    expect(botCalls.at(-1)).toMatchObject({ method: 'refundStarPayment', body: { user_id: buyer, telegram_payment_charge_id: 'ch_1' } })
    expect((await fresh(buyer)).items.subpoena).toBe(0)
    await expect(payments.refundCharge('ch_1')).rejects.toThrow(/refunded/)
  })
})
