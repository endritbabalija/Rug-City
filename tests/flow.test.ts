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

// Real scripted replies, but a test can make one fail.
vi.mock('@/lib/ai/suspect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/suspect')>()
  return { ...actual, suspectReply: vi.fn(actual.suspectReply) }
})

process.env.TELEGRAM_BOT_TOKEN = 'test-token'
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.ANTHROPIC_API_KEY

const { store } = await import('@/lib/store')
const rooms = await import('@/lib/rooms')
const payments = await import('@/lib/payments')
const { newPlayer } = await import('@/lib/player')
const season = await import('@/lib/season')
const { currentSeason } = await import('@/lib/seasons')
const ai = await import('@/lib/ai/suspect')
const { MEDIAN_AFTER_PLAYS } = await import('@/lib/game/scoring')
const { DEX_RELEASE_SCHEDULE } = await import('@/lib/game/dex')
const { BRIEFING_GRACE_MS, DEX_ID } = await import('@/lib/game/types')

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
    await rooms.ask(code, await fresh(a), suspect, 'Where were you at 3am?')
    // The first message is the suspect's opener.
    const thread = (await rooms.viewRoom(code, await fresh(a))).chats[suspect].messages.slice(1)
    expect(thread.map((m) => m.from)).toEqual(['player', 'suspect'])
    expect(thread[1].text.length).toBeGreaterThan(0)
  })

  it('refunds a question whose answer failed and removes it from the chat', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await rooms.act(code, await fresh(host), { type: 'skip' })
    const before = await rooms.viewRoom(code, await fresh(a))
    const suspect = before.mySuspects[0]

    vi.mocked(ai.suspectReply).mockRejectedValueOnce(new Error('AI down'))
    await expect(rooms.ask(code, await fresh(a), suspect, 'Where were you?')).rejects.toThrow('AI down')
    const after = await rooms.viewRoom(code, await fresh(a))
    expect(after.questionsLeft).toBe(before.questionsLeft)
    expect(after.chats[suspect].messages).toHaveLength(1)
    expect(await store().getChats(code, a)).toEqual([])

    // The thread isn't stuck waiting: the next question goes through.
    await rooms.ask(code, await fresh(a), suspect, 'Where were you?')
    expect((await store().getChats(code, a)).map((c) => [c.seq, c.from])).toEqual([
      [0, 'player'],
      [1, 'suspect'],
    ])
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

  it('ranks every finished case on the season leaderboard, with help lowering the rating', async () => {
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
    const aided = (await rooms.viewRoom(assisted, await fresh(y))).result!
    expect(aided).toMatchObject({ help: { hint: 1, trace: 0, subpoena: 0, dexHint: 0 }, penalty: 0.1, score: 108 })
    expect(aided.myAward).toMatchObject({ rating: 108 })

    const board = await season.leaderboard(await fresh(a))
    const ranked = (await store().getSeasonLeaderboard(board.season, 50)).rows.map((r) => r.playerId)
    expect(ranked).toEqual(expect.arrayContaining([host, a, b, x, y, z]))
    expect(ranked.indexOf(y)).toBeGreaterThan(ranked.indexOf(host))
    expect(ranked.indexOf(a)).toBeGreaterThan(ranked.indexOf(b))
    expect(board.me).toBe(ranked.indexOf(a) + 1)
    // Telegram ids never reach the client, only which row is yours.
    expect(board.rows.filter((r) => r.me)).toHaveLength(1)
    expect(JSON.stringify(board)).not.toContain(`"playerId"`)
  })

  it('rates a one-seat room like any other', async () => {
    const [admin] = ids(1)
    await mkPlayer(admin)
    process.env.ADMIN_TELEGRAM_IDS = String(admin)
    try {
      const code = await lobbyWith(admin, [])
      await playThrough(code, admin, { [admin]: ANSWER })
      const award = (await rooms.viewRoom(code, await fresh(admin))).result?.myAward
      expect(award?.unrated).toBeUndefined()
      expect(award?.rating).toBe(120)
      expect((await fresh(admin)).cluePoints).toBe(award?.total)
    } finally {
      delete process.env.ADMIN_TELEGRAM_IDS
    }
  })

  it('counts each finished room once toward its case and mode', async () => {
    const before = (await store().getCaseStats('mooncat-exit', 'crew'))?.plays ?? 0
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await playThrough(code, host, { [host]: ANSWER, [a]: ANSWER, [b]: WRONG })
    await rooms.settleAfter((await store().getRoom(code))!)
    expect((await store().getCaseStats('mooncat-exit', 'crew'))?.plays).toBe(before + 1)
    expect(await store().getCaseStats('mooncat-exit', 'solo')).toBeNull()
  })

  it('scores against the median once the mode has enough plays', async () => {
    const spy = vi.spyOn(store(), 'getCaseStats').mockResolvedValue({ caseId: 'mooncat-exit', mode: 'crew', plays: MEDIAN_AFTER_PLAYS, medianSec: 3600, updatedAt: 0 })
    try {
      const [host, a, b] = ids(3)
      for (const id of [host, a, b]) await mkPlayer(id)
      const code = await lobbyWith(host, [a, b])
      await playThrough(code, host, { [host]: ANSWER, [a]: ANSWER, [b]: ANSWER })
      expect((await rooms.viewRoom(code, await fresh(host))).result?.targetSec).toBe(3600)
    } finally {
      spy.mockRestore()
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

    // Their next, rated case pays out to both (as if it were a different case).
    const played = vi.spyOn(store(), 'hasPlayed').mockResolvedValue(false)
    const second = await lobbyWith(host, [friend, other])
    try {
      await playThrough(second, host, { [host]: ANSWER, [friend]: ANSWER, [other]: ANSWER })
    } finally {
      played.mockRestore()
    }
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

  it('settles a room twice without writing a second result or paying twice', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await playThrough(code, host, { [host]: ANSWER, [a]: ANSWER, [b]: WRONG })
    const points = (await fresh(a)).cluePoints
    const award = (await rooms.viewRoom(code, await fresh(a))).result?.myAward

    // Undo the room's claim, as if a crash had lost it, and settle again.
    const reopened = await store().updateRoom(code, (s) => ({ ...s, rewardsSettled: false }))
    await rooms.settleAfter(reopened)
    expect((await fresh(a)).cluePoints).toBe(points)
    expect((await store().recentResults(a, 10)).filter((r) => r.roomCode === code)).toHaveLength(1)
    expect((await rooms.viewRoom(code, await fresh(a))).result?.myAward).toEqual(award)
  })

  it('grants season rewards only after the season, and only once', async () => {
    const now = Date.now()
    const { id, end } = await currentSeason(now)
    await expect(season.grantSeasonRewards(id, now)).rejects.toThrow(/hasn't ended/)

    const first = await season.grantSeasonRewards(id, end)
    expect(first.granted).toBe(first.rewarded)
    expect(first.rewarded).toBeGreaterThan(0)
    const top = (await store().getSeasonLeaderboard(id, 1)).rows[0]
    const winner = await fresh(top.playerId)
    expect(await store().getBadges(top.playerId)).toContain(`s${id}-top10`)
    expect(winner.caseCredits).toBeGreaterThanOrEqual(5)

    const second = await season.grantSeasonRewards(id, end)
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
        expect.objectContaining({ playerId: host, props: { caseId: 'mooncat-exit', mode: 'crew', seats: 3, code } }),
      ])
      const finishes = events.filter((e) => e.name === 'case_finish')
      expect(finishes.map((e) => e.playerId).sort()).toEqual([host, a, b].sort())
      expect(finishes.find((e) => e.playerId === b)?.props).toEqual({ caseId: 'mooncat-exit', code, correct: 2, total: 55, unrated: null })
    } finally {
      write.mockRestore()
    }
  })
})

describe('solo with Dex', () => {
  it('plays a case from create to verdict, rated as solo, for one case', async () => {
    const [me] = ids(1)
    await mkPlayer(me)
    const write = vi.spyOn(store(), 'trackEvents')
    try {
      const code = await rooms.createSolo(await fresh(me), 'mooncat-exit')
      expect((await fresh(me)).freeCaseDay).toBeDefined()
      const briefing = await rooms.viewRoom(code, await fresh(me))
      expect(briefing).toMatchObject({ mode: 'solo', phase: 'briefing', member: true })

      await rooms.act(code, await fresh(me), { type: 'ready' })
      const shared = await rooms.act(code, await fresh(me), { type: 'askDex', ask: 'clue' })
      expect(shared.dexShared).toHaveLength(1)
      await rooms.act(code, await fresh(me), { type: 'askDex', ask: 'hint' })
      const view = await rooms.viewRoom(code, await fresh(me))
      // The opener, then a scripted line for the clue and one for the hint.
      expect(view.dex!.messages).toHaveLength(3)
      expect(view.dex!.messages[1].clue?.id).toBe(shared.dexShared![0])
      expect(view.dex!.messages[2].hint).toBe(view.hints[0])
      expect(view.dex!.hintsLeft).toBe(1)

      await rooms.act(code, await fresh(me), { type: 'callVote' })
      const done = await rooms.act(code, await fresh(me), { type: 'vote', vote: ANSWER })
      expect(done.phase).toBe('reveal')
      expect(done.result!.help.dexHint).toBe(1)
      expect(done.result!.penalty).toBeCloseTo(0.1)
      // Only the player is settled; Dex has no player row.
      expect(Object.keys(done.awards!)).toEqual([String(me)])
      expect(done.awards![String(me)].unrated).toBeUndefined()

      const [row] = await store().recentResults(me, 1)
      expect(row).toMatchObject({ roomCode: code, mode: 'solo', seats: 1, correct: 3 })
      expect(row.rating).toBe(done.result!.score)
      expect((await store().getCaseStats('mooncat-exit', 'solo'))?.plays).toBeGreaterThanOrEqual(1)

      await new Promise((r) => setTimeout(r, 0))
      const events = write.mock.calls.flatMap(([batch]) => batch)
      expect(events.find((e) => e.name === 'case_start' && e.props.code === code)?.props).toEqual({ caseId: 'mooncat-exit', mode: 'solo', seats: 1, code })
      expect(events.filter((e) => e.name === 'dex_ask' && e.props.code === code).map((e) => e.props.ask)).toEqual(['clue', 'hint'])
    } finally {
      write.mockRestore()
    }
  })

  it('charges a credit once the free case is used, and refunds if the room fails', async () => {
    const [me] = ids(1)
    await mkPlayer(me)
    await rooms.createSolo(await fresh(me), 'mooncat-exit')
    await expect(rooms.createSolo(await fresh(me), 'mooncat-exit')).rejects.toMatchObject({ code: 'NO_CASES' })

    await store().updatePlayer(me, (p) => ({ ...p, caseCredits: 1 }))
    const create = vi.spyOn(store(), 'createRoom').mockRejectedValueOnce(new Error('DB down'))
    try {
      await expect(rooms.createSolo(await fresh(me), 'mooncat-exit')).rejects.toThrow('DB down')
    } finally {
      create.mockRestore()
    }
    expect((await fresh(me)).caseCredits).toBe(1)
    await rooms.createSolo(await fresh(me), 'mooncat-exit')
    expect((await fresh(me)).caseCredits).toBe(0)
  })

  it('gives the free case back when the room fails', async () => {
    const [me] = ids(1)
    await mkPlayer(me)
    const create = vi.spyOn(store(), 'createRoom').mockRejectedValueOnce(new Error('DB down'))
    try {
      await expect(rooms.createSolo(await fresh(me), 'mooncat-exit')).rejects.toThrow('DB down')
    } finally {
      create.mockRestore()
    }
    expect((await fresh(me)).freeCaseDay).toBeUndefined()
  })

  it('keeps other players out', async () => {
    const [me, other] = ids(2)
    await mkPlayer(me)
    await mkPlayer(other)
    const code = await rooms.createSolo(await fresh(me), 'mooncat-exit')
    await expect(rooms.act(code, await fresh(other), { type: 'join' })).rejects.toMatchObject({ code: 'WRONG_PHASE' })
    await rooms.act(code, await fresh(me), { type: 'ready' })
    await expect(rooms.act(code, await fresh(other), { type: 'askDex', ask: 'clue' })).rejects.toMatchObject({ code: 'NOT_IN_ROOM' })
  })
})

describe('Dex in the crew', () => {
  it('stays out of crews while dex_crew is off', async () => {
    const [host, a] = ids(2)
    for (const id of [host, a]) await mkPlayer(id)
    const code = await lobbyWith(host, [a])
    await expect(rooms.act(code, await fresh(host), { type: 'addDex' })).rejects.toMatchObject({ code: 'NOT_AVAILABLE' })
  })

  it('plays 2 humans + Dex from lobby to verdict, rated as crew', async () => {
    const [host, a] = ids(2)
    for (const id of [host, a]) await mkPlayer(id)
    const code = await lobbyWith(host, [a])
    const write = vi.spyOn(store(), 'trackEvents')
    process.env.FLAGS = 'dex_crew'
    try {
      expect((await rooms.viewRoom(code, await fresh(host))).minPlayers).toBe(3)
      await rooms.act(code, await fresh(host), { type: 'addDex' })
      const lobby = await rooms.viewRoom(code, await fresh(a))
      expect(lobby).toMatchObject({ dexSeated: true, minPlayers: 2 })

      const started = await rooms.act(code, await fresh(host), { type: 'start' })
      expect(started.seats).toEqual([host, a, DEX_ID])
      await rooms.act(code, await fresh(host), { type: 'skip' })
      // Dex's notes go public on his timer, for everyone.
      const later = Date.now() + DEX_RELEASE_SCHEDULE.firstMs
      const clock = vi.spyOn(Date, 'now').mockReturnValue(later)
      try {
        for (const id of [host, a]) expect((await rooms.viewRoom(code, await fresh(id))).dex!.shared).toHaveLength(1)
      } finally {
        clock.mockRestore()
      }
      // Any player can ask him for a hint; it lands on the shared board.
      await rooms.act(code, await fresh(a), { type: 'askDex', ask: 'hint' })
      const hostView = await rooms.viewRoom(code, await fresh(host))
      expect(hostView.hints).toHaveLength(1)
      expect(hostView.dex!.messages.at(-1)?.hint).toBe(hostView.hints[0])

      await rooms.act(code, await fresh(host), { type: 'callVote' })
      await rooms.act(code, await fresh(host), { type: 'vote', vote: ANSWER })
      const done = await rooms.act(code, await fresh(a), { type: 'vote', vote: ANSWER })
      expect(done.phase).toBe('reveal')
      expect(done.result!.help.dexHint).toBe(1)
      expect(Object.keys(done.awards!).sort()).toEqual([String(host), String(a)].sort())
      for (const id of [host, a]) {
        const [row] = await store().recentResults(id, 1)
        expect(row).toMatchObject({ roomCode: code, mode: 'crew', seats: 2, correct: 3 })
        expect(row.rating).toBe(done.result!.score)
      }

      await new Promise((r) => setTimeout(r, 0))
      const events = write.mock.calls.flatMap(([batch]) => batch).filter((e) => e.props.code === code)
      expect(events.find((e) => e.name === 'case_start')?.props).toEqual({ caseId: 'mooncat-exit', mode: 'crew', seats: 2, code })
    } finally {
      delete process.env.FLAGS
      write.mockRestore()
    }
  })

  it('records invite_sent without changing the room', async () => {
    const [host] = ids(1)
    await mkPlayer(host)
    const code = await rooms.createRoom(await fresh(host), 'mooncat-exit')
    const before = await store().getRoom(code)
    const write = vi.spyOn(store(), 'trackEvents')
    try {
      await rooms.act(code, await fresh(host), { type: 'invited' })
      await new Promise((r) => setTimeout(r, 0))
      const events = write.mock.calls.flatMap(([batch]) => batch)
      expect(events.filter((e) => e.name === 'invite_sent')).toEqual([expect.objectContaining({ playerId: host, props: { code } })])
      expect(await store().getRoom(code)).toEqual(before)
    } finally {
      write.mockRestore()
    }
  })
})

describe('suspects with Dex seated', () => {
  it('lets a solo player question every suspect, including ones Dex used to hold', async () => {
    const [me] = ids(1)
    await mkPlayer(me)
    const code = await rooms.createSolo(await fresh(me), 'mooncat-exit')
    await rooms.act(code, await fresh(me), { type: 'ready' })
    const view = await rooms.viewRoom(code, await fresh(me))
    expect(view.mySuspects).toEqual(view.case.suspects.map((s) => s.id))
    // The second suspect went to Dex's seat before the fix.
    const room = await rooms.ask(code, await fresh(me), view.case.suspects[1].id, 'Where were you when the pool drained?')
    expect(room.questionsUsed[String(me)]).toBe(1)
  })
})

describe('a started case counts as played', () => {
  it('makes a replay of an abandoned solo case unrated, and still charges for it', async () => {
    const [me] = ids(1)
    await mkPlayer(me)
    const first = await rooms.createSolo(await fresh(me), 'mooncat-exit')
    await rooms.act(first, await fresh(me), { type: 'ready' })
    expect(await store().hasPlayed(me, 'mooncat-exit')).toBe(true)
    // The room being played doesn't count against itself.
    expect(await store().hasPlayed(me, 'mooncat-exit', first)).toBe(false)
    expect(await store().playedCaseIds(me)).toContain('mooncat-exit')

    // Abandoned at the investigation; back the next day with a credit.
    await store().updatePlayer(me, (p) => ({ ...p, caseCredits: 1 }))
    const second = await rooms.createSolo(await fresh(me), 'mooncat-exit')
    expect((await fresh(me)).caseCredits).toBe(0)
    await rooms.act(second, await fresh(me), { type: 'ready' })
    await rooms.act(second, await fresh(me), { type: 'callVote' })
    const done = await rooms.act(second, await fresh(me), { type: 'vote', vote: ANSWER })
    expect(done.awards![String(me)]).toMatchObject({ unrated: 'replay', total: 0 })
    expect((await fresh(me)).cluePoints ?? 0).toBe(0)
  })

  it('rates the room where the case was first started', async () => {
    const [me] = ids(1)
    await mkPlayer(me)
    const code = await rooms.createSolo(await fresh(me), 'mooncat-exit')
    await rooms.act(code, await fresh(me), { type: 'ready' })
    await rooms.act(code, await fresh(me), { type: 'callVote' })
    const done = await rooms.act(code, await fresh(me), { type: 'vote', vote: ANSWER })
    expect(done.awards![String(me)].unrated).toBeUndefined()
  })

  it('records a start for every human seat in a crew, and none in a playtest', async () => {
    const [host, a, b, admin] = ids(4)
    for (const id of [host, a, b, admin]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await rooms.act(code, await fresh(host), { type: 'skip' })
    for (const id of [host, a, b]) expect(await store().playedCaseIds(id)).toEqual(['mooncat-exit'])

    process.env.ADMIN_TELEGRAM_IDS = String(admin)
    try {
      const test = await rooms.createPlaytest(await fresh(admin), 'mooncat-exit')
      await rooms.act(test, await fresh(admin), { type: 'ready' })
      expect(await store().playedCaseIds(admin)).toEqual([])
    } finally {
      delete process.env.ADMIN_TELEGRAM_IDS
    }
  })

  it('still charges and writes an unrated replay when soloing a closed case', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    await playThrough(await lobbyWith(host, [a, b]), host, { [host]: ANSWER, [a]: ANSWER, [b]: ANSWER })

    // a joined, so their free case is still there: the solo spends it.
    expect((await fresh(a)).freeCaseDay).toBeUndefined()
    const code = await rooms.createSolo(await fresh(a), 'mooncat-exit')
    expect((await fresh(a)).freeCaseDay).toBeDefined()
    await rooms.act(code, await fresh(a), { type: 'ready' })
    await rooms.act(code, await fresh(a), { type: 'callVote' })
    await rooms.act(code, await fresh(a), { type: 'vote', vote: ANSWER })
    const row = (await store().recentResults(a, 5)).find((r) => r.roomCode === code)
    expect(row).toMatchObject({ unrated: 'replay', total: 0 })
  })
})

describe('the briefing grace', () => {
  it('lets any member start the investigation once the host has been gone long enough', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await expect(rooms.act(code, await fresh(a), { type: 'skip' })).rejects.toMatchObject({ code: 'HOST_ONLY' })

    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + BRIEFING_GRACE_MS)
    try {
      expect((await rooms.viewRoom(code, await fresh(a))).briefingGraceEndsAt).toBeLessThanOrEqual(Date.now())
      const started = await rooms.act(code, await fresh(a), { type: 'skip' })
      expect(started.phase).toBe('investigate')
    } finally {
      clock.mockRestore()
    }
    for (const id of [host, a, b]) expect(await store().playedCaseIds(id)).toEqual(['mooncat-exit'])
  })
})

describe('closing the vote early', () => {
  it('still works for the host and writes no-vote for players who did not vote', async () => {
    const [host, a, b] = ids(3)
    for (const id of [host, a, b]) await mkPlayer(id)
    const code = await lobbyWith(host, [a, b])
    await rooms.act(code, await fresh(host), { type: 'start' })
    await rooms.act(code, await fresh(host), { type: 'skip' })
    await rooms.act(code, await fresh(host), { type: 'callVote' })
    await rooms.act(code, await fresh(host), { type: 'vote', vote: ANSWER })
    const done = await rooms.act(code, await fresh(host), { type: 'closeVote' })
    expect(done.phase).toBe('reveal')
    expect(done.awards![String(host)].unrated).toBeUndefined()
    for (const id of [a, b]) {
      expect(done.awards![String(id)]).toMatchObject({ unrated: 'no-vote', total: 0 })
      expect((await store().recentResults(id, 5)).find((r) => r.roomCode === code)).toMatchObject({ unrated: 'no-vote' })
    }
  })
})
