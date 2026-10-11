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
const season = await import('@/lib/season')
const { seasonOf, SEASON_MS } = await import('@/lib/game/progress')

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

describe('solo testing', () => {
  it('lets an admin host start alone, but not anyone else', async () => {
    const [admin, other] = ids(2)
    await mkPlayer(admin)
    await mkPlayer(other)
    process.env.ADMIN_TELEGRAM_IDS = `999,${admin}`
    try {
      const solo = await lobbyWith(admin, [])
      expect((await rooms.viewRoom(solo, await fresh(admin))).minPlayers).toBe(1)
      const started = await rooms.act(solo, await fresh(admin), { type: 'start' })
      expect(started.phase).toBe('briefing')
      const view = await rooms.viewRoom(solo, await fresh(admin))
      // Alone, you hold every clue and every suspect talks to you.
      expect(view.myClues.length).toBe(11)
      expect(view.mySuspects.length).toBe(5)

      const normal = await lobbyWith(other, [])
      await expect(rooms.act(normal, await fresh(other), { type: 'start' })).rejects.toMatchObject({ code: 'NOT_ENOUGH_PLAYERS' })
    } finally {
      delete process.env.ADMIN_TELEGRAM_IDS
    }
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

const ANSWER = { culprit: 'brad', motive: 'margin', trail: 'exchange' }
const WRONG = { culprit: 'whiskers', motive: 'margin', trail: 'exchange' }

/** Start, skip the briefing, call the vote and have everyone vote. */
async function playThrough(code: string, host: number, votes: Record<number, typeof ANSWER>) {
  await rooms.act(code, await fresh(host), { type: 'start' })
  await rooms.act(code, await fresh(host), { type: 'skip' })
  await rooms.act(code, await fresh(host), { type: 'callVote' })
  for (const [id, vote] of Object.entries(votes)) await rooms.act(code, await fresh(Number(id)), { type: 'vote', vote })
}

describe('Clue Points', () => {
  it('awards each seat once for their own vote and shows it on the reveal', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await playThrough(code, host, { [host]: ANSWER, [a]: ANSWER, [b]: WRONG })

    expect((await fresh(host)).cluePoints).toBeGreaterThanOrEqual(80)
    // b named the wrong culprit but the crew got it right: crew bonus, motive, trail, speed, streak.
    expect((await fresh(b)).cluePoints).toBe(15 + 15 + 10 + 10 + 5)

    const view = await rooms.viewRoom(code, await fresh(b))
    expect(view.result?.myAward).toMatchObject({ total: 55, rating: expect.any(Number) })
    expect(view.result?.crew.map((p) => p.correct)).toEqual([3, 3, 2])

    // Replaying the same case earns nothing.
    const again = await lobbyWith(a, [host, b])
    await store().updatePlayer(a, (p) => ({ ...p, caseCredits: 1 }))
    await playThrough(again, a, { [host]: ANSWER, [a]: ANSWER, [b]: ANSWER })
    expect((await rooms.viewRoom(again, await fresh(a))).result?.myAward?.unrated).toBe('replay')
    expect((await fresh(b)).cluePoints).toBe(55)
  })

  it('ranks unassisted cases on the season leaderboard and leaves power-up cases off it', async () => {
    const [host, a, b, x, y, z] = ids(6)
    for (const id of [host, a, b, x, y, z]) await mkPlayer(id)
    await playThrough(await lobbyWith(host, [a, b]), host, { [host]: ANSWER, [a]: WRONG, [b]: ANSWER })

    const assisted = await lobbyWith(x, [y, z])
    await rooms.act(assisted, await fresh(x), { type: 'start' })
    await rooms.act(assisted, await fresh(x), { type: 'skip' })
    await store().updatePlayer(y, (p) => ({ ...p, items: { ...p.items, hint: 1 } }))
    await rooms.act(assisted, await fresh(y), { type: 'hint' })
    await rooms.act(assisted, await fresh(x), { type: 'callVote' })
    for (const id of [x, y, z]) await rooms.act(assisted, await fresh(id), { type: 'vote', vote: ANSWER })

    expect((await fresh(y)).cluePoints).toBeGreaterThan(0)
    expect((await rooms.viewRoom(assisted, await fresh(y))).result?.myAward).toMatchObject({ assisted: true, rating: undefined })

    const board = await season.leaderboard(await fresh(a))
    const ranked = (await store().getSeasonLeaderboard(board.season, 50)).rows.map((r) => r.playerId)
    expect(ranked).toEqual(expect.arrayContaining([host, a, b]))
    expect(ranked).not.toContain(y)
    expect(ranked.indexOf(a)).toBeGreaterThan(ranked.indexOf(b))
    expect(board.me).toBe(ranked.indexOf(a) + 1)
    // Telegram ids never reach the client, only which row is yours.
    expect(board.rows.filter((r) => r.me)).toHaveLength(1)
    expect(JSON.stringify(board)).not.toContain(`"playerId"`)
  })

  it("doesn't rate an admin playing alone", async () => {
    const [admin] = ids(1)
    await mkPlayer(admin)
    process.env.ADMIN_TELEGRAM_IDS = String(admin)
    try {
      const code = await lobbyWith(admin, [])
      await playThrough(code, admin, { [admin]: ANSWER })
      expect((await rooms.viewRoom(code, await fresh(admin))).result?.myAward?.unrated).toBe('solo')
      expect((await fresh(admin)).cluePoints ?? 0).toBe(0)
    } finally {
      delete process.env.ADMIN_TELEGRAM_IDS
    }
  })

  it('still settles every seat when a leaderboard write fails', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    const spy = vi.spyOn(store(), 'raiseSeasonRating').mockRejectedValue(new Error('relation "season_ratings" does not exist'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      // The last vote succeeds even though the leaderboard is down.
      await playThrough(code, host, { [host]: ANSWER, [a]: ANSWER, [b]: ANSWER })
    } finally {
      spy.mockRestore()
      err.mockRestore()
    }
    for (const id of [host, a, b]) {
      expect((await fresh(id)).cluePoints).toBeGreaterThan(0)
      expect((await rooms.viewRoom(code, await fresh(id))).result).toMatchObject({ settled: true, myAward: { total: expect.any(Number) } })
    }
  })

  it('pays the referral on the friend’s first rated case, not on an unrated one', async () => {
    const [host, friend, other, admin] = ids(4)
    await mkPlayer(host)
    await mkPlayer(friend, host)
    await mkPlayer(other)
    await mkPlayer(admin)
    // The friend's first finish doesn't count: they never vote.
    const first = await lobbyWith(admin, [friend, other])
    await playThrough(first, admin, { [admin]: ANSWER, [other]: ANSWER })
    await rooms.act(first, await fresh(admin), { type: 'closeVote' })
    expect((await rooms.viewRoom(first, await fresh(friend))).result?.myAward?.unrated).toBe('no-vote')
    expect((await fresh(friend)).referralSettled).toBeFalsy()
    expect((await fresh(host)).caseCredits).toBe(0)

    // Their next, rated case pays out to both.
    await store().updatePlayer(friend, (p) => ({ ...p, playedCases: [] }))
    const second = await lobbyWith(host, [friend, other])
    await playThrough(second, host, { [host]: ANSWER, [friend]: ANSWER, [other]: ANSWER })
    expect((await fresh(friend)).caseCredits).toBe(1)
    expect((await fresh(host)).caseCredits).toBe(1)
    const hostAward = (await rooms.viewRoom(second, await fresh(host))).result!.myAward!.total
    expect((await fresh(host)).cluePoints).toBe(hostAward + 50)
  })

  it('never lowers a stored season rating when writes land out of order', async () => {
    const base = { season: 99, playerId: 1, name: 'Ana', updatedAt: 1 }
    await store().raiseSeasonRating({ ...base, rating: 180, cases: 2 })
    await store().raiseSeasonRating({ ...base, rating: 100, cases: 1, updatedAt: 2 })
    expect((await store().getSeasonLeaderboard(99, 5)).rows[0]).toMatchObject({ rating: 180, cases: 2, updatedAt: 1 })
    await store().raiseSeasonRating({ ...base, rating: 180, cases: 3, updatedAt: 3 })
    expect((await store().getSeasonLeaderboard(99, 5)).rows[0]).toMatchObject({ rating: 180, cases: 3, updatedAt: 1 })
  })

  it('grants season rewards only after the season, and only once', async () => {
    const now = Date.now()
    await expect(season.grantSeasonRewards(seasonOf(now), now)).rejects.toThrow(/hasn't ended/)

    const later = now + SEASON_MS
    const first = await season.grantSeasonRewards(seasonOf(now), later)
    expect(first.granted).toBe(first.rewarded)
    expect(first.rewarded).toBeGreaterThan(0)
    const top = (await store().getSeasonLeaderboard(seasonOf(now), 1)).rows[0]
    const winner = await fresh(top.playerId)
    expect(winner.badges).toContain(`s${seasonOf(now)}-top10`)
    expect(winner.caseCredits).toBeGreaterThanOrEqual(5)

    const second = await season.grantSeasonRewards(seasonOf(now), later)
    expect(second.granted).toBe(0)
    expect((await fresh(top.playerId)).caseCredits).toBe(winner.caseCredits)
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

describe('events', () => {
  it('records the start and every seat finishing a case', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    const write = vi.spyOn(store(), 'trackEvents')
    try {
      await playThrough(code, host, { [host]: ANSWER, [a]: ANSWER, [b]: WRONG })
      await new Promise((r) => setTimeout(r, 0))
      const events = write.mock.calls.flatMap(([batch]) => batch).filter((e) => e.props.code === code)
      expect(events.filter((e) => e.name === 'case_start')).toEqual([
        expect.objectContaining({ playerId: host, props: { caseId: 'mooncat-exit', seats: 3, code } }),
      ])
      const finishes = events.filter((e) => e.name === 'case_finish')
      expect(finishes.map((e) => e.playerId).sort()).toEqual([host, a, b].sort())
      expect(finishes.find((e) => e.playerId === b)?.props).toEqual({ caseId: 'mooncat-exit', code, correct: 2, total: 55, unrated: null })
    } finally {
      write.mockRestore()
    }
  })
})
