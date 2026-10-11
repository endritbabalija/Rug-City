import { describe, expect, it, vi } from 'vitest'

// Slice 7: day-one free cases, the tutorial, and Home's Next case card.
vi.mock('@/lib/telegram/bot-api', () => ({ botApi: vi.fn(async () => true), miniAppLink: () => 'https://t.me/bot/app' }))

process.env.TELEGRAM_BOT_TOKEN = 'test-token'
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.ANTHROPIC_API_KEY

const { store } = await import('@/lib/store')
const rooms = await import('@/lib/rooms')
const { publicPlayer } = await import('@/lib/server')
const { caseBoard, resetCaseCache } = await import('@/lib/cases')
const { mooncat } = await import('@/lib/cases/mooncat')
const engine = await import('@/lib/game/engine')
const { reachTutorialStep, TUTORIAL_CASE_ID, TUTORIAL_TIPS } = await import('@/lib/game/dex')
const { TUTORIAL_STEPS } = await import('@/lib/game/types')
const { buildView } = await import('@/lib/game/view')
const { RANKS } = await import('@/lib/game/progress')
const { districtById, pickNextCase, unlockProgress } = await import('@/lib/districts')
const { consumeCase, DAY_ONE_FREE_CASES, freeCasesToday, newPlayer, refundCase } = await import('@/lib/player')
type Player = import('@/lib/player').Player
type CaseRow = import('@/lib/store/types').CaseRow

const DAY = 86_400_000
const SIGNUP = Date.UTC(2026, 9, 14, 9)
const MIDNIGHT = Date.UTC(2026, 9, 15)
const ANSWER = mooncat.answer

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as { code?: string }).code
  }
  return null
}

/** Use cases until NO_CASES; returns how many were free. */
function freeRun(p: Player, now: number, dayOne: boolean) {
  let n = 0
  while (code(() => (p = consumeCase(p, now, dayOne))) === null) n++
  return n
}

describe('day-one free cases', () => {
  const signedUp = (at = SIGNUP) => newPlayer({ id: 1, name: 'Ana' }, at)

  it(`gives a new player ${DAY_ONE_FREE_CASES} free cases on the signup day, then 1 the next day`, () => {
    let p = signedUp()
    expect(freeCasesToday(p, SIGNUP, true)).toBe(DAY_ONE_FREE_CASES)
    for (let left = DAY_ONE_FREE_CASES - 1; left >= 0; left--) {
      p = consumeCase(p, SIGNUP + 1000, true)
      expect(freeCasesToday(p, SIGNUP + 1000, true)).toBe(left)
    }
    expect(p.dayOneUsed).toBe(DAY_ONE_FREE_CASES)
    expect(p.freeCaseDay).toBeUndefined() // the daily case isn't used on day one
    expect(code(() => consumeCase(p, SIGNUP + 2000, true))).toBe('NO_CASES')

    const nextDay = SIGNUP + DAY
    expect(freeCasesToday(p, nextDay, true)).toBe(1)
    expect(freeRun(p, nextDay, true)).toBe(1)
  })

  it('moves to credits once the day-one cases are used', () => {
    let p: Player = { ...signedUp(), dayOneUsed: DAY_ONE_FREE_CASES, caseCredits: 2 }
    p = consumeCase(p, SIGNUP, true)
    expect(p).toMatchObject({ caseCredits: 1, dayOneUsed: DAY_ONE_FREE_CASES })
  })

  it("leaves a player who signed up before today on the old rule", () => {
    const old = signedUp(SIGNUP - 3 * DAY)
    expect(freeCasesToday(old, SIGNUP, true)).toBe(1)
    expect(freeRun(old, SIGNUP, true)).toBe(1)
  })

  it('keeps the old rule for everyone with the flag off', () => {
    expect(freeCasesToday(signedUp(), SIGNUP, false)).toBe(1)
    expect(freeRun(signedUp(), SIGNUP, false)).toBe(1)
  })

  it('ends the signup day at UTC midnight', () => {
    const lastMs = signedUp(MIDNIGHT - 1)
    expect(freeCasesToday(lastMs, MIDNIGHT - 1, true)).toBe(DAY_ONE_FREE_CASES)
    expect(freeCasesToday(lastMs, MIDNIGHT, true)).toBe(1)
    expect(freeRun(lastMs, MIDNIGHT, true)).toBe(1)
    // Signed up at midnight: the whole day is day one.
    const firstMs = signedUp(MIDNIGHT)
    expect(freeRun(firstMs, MIDNIGHT + DAY - 1, true)).toBe(DAY_ONE_FREE_CASES)
  })

  it('refunds to the source it was taken from', () => {
    const p = signedUp()
    expect(refundCase(consumeCase(p, SIGNUP, true), 'dayOne').dayOneUsed).toBe(0)
    expect(refundCase(consumeCase(p, SIGNUP, false), 'free').freeCaseDay).toBeUndefined()
    expect(refundCase(p, 'dayOne').dayOneUsed).toBe(0) // never below zero
  })
})

describe('tutorial room', () => {
  const me = { id: 7, name: 'Ana' }
  const T0 = 1_000_000
  const tutorialRoom = () => engine.createSoloRoom('TUTOR', mooncat, me, T0, { tutorial: true })

  it('is only made when asked, and never for a playtest', () => {
    expect(engine.createSoloRoom('SOLO1', mooncat, me, T0).tutorial).toBeUndefined()
    expect(tutorialRoom()).toMatchObject({ tutorial: true, tutorialSteps: [] })
    expect(engine.createSoloRoom('PLAY1', mooncat, me, T0, { tutorial: true, playtest: true }).tutorial).toBeUndefined()
  })

  it('records each step once, in its own phase', () => {
    let s = reachTutorialStep(tutorialRoom(), me.id, 'briefing', T0 + 1)
    expect(reachTutorialStep(s, me.id, 'briefing', T0 + 2)).toBe(s)
    expect(code(() => reachTutorialStep(s, me.id, 'clue', T0 + 3))).toBe('WRONG_PHASE')

    s = engine.ready(s, me.id, T0 + 10)
    for (const step of ['clue', 'explorer', 'chat'] as const) s = reachTutorialStep(s, me.id, step, T0 + 20)
    expect(code(() => reachTutorialStep(s, me.id, 'vote', T0 + 30))).toBe('WRONG_PHASE')
    s = reachTutorialStep(engine.callVote(s, me.id, T0 + 40), me.id, 'vote', T0 + 50)
    expect(s.tutorialSteps!.map((r) => r.step)).toEqual([...TUTORIAL_STEPS])
  })

  it('refuses steps outside a tutorial, and from non-members', () => {
    expect(code(() => reachTutorialStep(engine.createSoloRoom('SOLO1', mooncat, me, T0), me.id, 'briefing', T0))).toBe('NOT_TUTORIAL')
    expect(code(() => reachTutorialStep(tutorialRoom(), 99, 'briefing', T0))).not.toBeNull()
  })

  it('has a tip for every step, and only shows them to the player in a tutorial room', () => {
    for (const step of TUTORIAL_STEPS) expect(TUTORIAL_TIPS[step].length).toBeGreaterThan(20)
    const s = reachTutorialStep(tutorialRoom(), me.id, 'briefing', T0 + 1)
    expect(buildView(s, mooncat, me.id, T0 + 2, {}).tutorial).toEqual({ tips: TUTORIAL_TIPS, reached: [{ step: 'briefing', at: T0 + 1 }] })
    expect(buildView(s, mooncat, 99, T0 + 2, {}).tutorial).toBeNull()
    expect(buildView(engine.createSoloRoom('SOLO1', mooncat, me, T0), mooncat, me.id, T0, {}).tutorial).toBeNull()
  })
})

describe('Next case and unlock progress', () => {
  const swamp = 'memecoin-swamp'
  const c = (id: string, played = false, district = swamp) => ({ id, district, played })

  it('picks the newest unplayed case in an open district', () => {
    const newestFirst = [c('teaser', false, 'sybil-square'), c('new', true), c('mid'), c('old')]
    expect(pickNextCase(newestFirst, [swamp])).toEqual({ id: 'mid', startHere: false })
  })

  it('picks the tutorial case for a player with no results, played or not', () => {
    expect(pickNextCase([c('new'), c(TUTORIAL_CASE_ID)], [swamp], TUTORIAL_CASE_ID)).toEqual({ id: TUTORIAL_CASE_ID, startHere: true })
    // Not on the board, or its district isn't open: fall back to the newest.
    expect(pickNextCase([c('new')], [swamp], TUTORIAL_CASE_ID)).toEqual({ id: 'new', startHere: false })
    expect(pickNextCase([c(TUTORIAL_CASE_ID, false, 'sybil-square')], [swamp], TUTORIAL_CASE_ID)).toBeNull()
  })

  it('picks nothing when every open case is played', () => {
    expect(pickNextCase([c('a', true), c('b', true), c('teaser', false, 'sybil-square')], [swamp])).toBeNull()
    expect(pickNextCase([], [swamp])).toBeNull()
  })

  it('measures Clue Points towards a locked rank at 0, mid-way and at the threshold', () => {
    const sybil = districtById('sybil-square')!
    const need = RANKS.find((r) => r.title === sybil.unlockRank)!.at
    expect(unlockProgress({ cluePoints: 0 }, sybil)).toEqual({ have: 0, need })
    expect(unlockProgress({ cluePoints: need / 2 }, sybil)).toEqual({ have: need / 2, need })
    expect(unlockProgress({ cluePoints: need }, sybil)).toEqual({ have: need, need })
    expect(unlockProgress({ cluePoints: need * 3 }, sybil)).toEqual({ have: need, need })
    expect(unlockProgress({ cluePoints: 120 }, districtById('defi-docks')!).need).toBe(RANKS.find((r) => r.title === 'Chief')!.at)
  })
})

// ── Against the store, flag `tutorial` on ──────────────────────────────────

let nextId = 7000
async function mkPlayer(createdAt = Date.now()) {
  const id = nextId++
  return store().createPlayer(newPlayer({ id, name: `P${id}` }, createdAt))
}
const fresh = async (id: number) => (await store().getPlayer(id))!

async function withTutorial<T>(fn: () => Promise<T>) {
  process.env.FLAGS = 'tutorial'
  try {
    return await fn()
  } finally {
    delete process.env.FLAGS
  }
}

async function finishTutorial(id: number) {
  const code = await rooms.createSolo(await fresh(id), TUTORIAL_CASE_ID)
  await rooms.act(code, await fresh(id), { type: 'ready' })
  await rooms.act(code, await fresh(id), { type: 'callVote' })
  await rooms.act(code, await fresh(id), { type: 'vote', vote: ANSWER })
  return code
}

describe('first day, end to end', () => {
  it('opens the tutorial for a fresh player, walks the tips, and leaves 2 free cases that day', () =>
    withTutorial(async () => {
      const me = await mkPlayer()
      const write = vi.spyOn(store(), 'trackEvents')
      try {
        expect((await publicPlayer(me)).freeCasesToday).toBe(DAY_ONE_FREE_CASES)
        const board = await caseBoard(me, [], Date.now(), TUTORIAL_CASE_ID)
        expect(board.nextCase).toEqual({ id: TUTORIAL_CASE_ID, startHere: true })

        const code = await rooms.createSolo(await fresh(me.id), TUTORIAL_CASE_ID)
        expect(await publicPlayer(await fresh(me.id))).toMatchObject({ freeCasesToday: 2, freeCaseAvailable: true })
        expect((await store().getRoom(code))?.tutorial).toBe(true)

        await rooms.act(code, await fresh(me.id), { type: 'tutorialStep', step: 'briefing' })
        await rooms.act(code, await fresh(me.id), { type: 'tutorialStep', step: 'briefing' }) // a repeat isn't tracked
        await rooms.act(code, await fresh(me.id), { type: 'ready' })
        for (const step of ['clue', 'explorer', 'chat'] as const) await rooms.act(code, await fresh(me.id), { type: 'tutorialStep', step })
        await rooms.act(code, await fresh(me.id), { type: 'callVote' })
        await rooms.act(code, await fresh(me.id), { type: 'tutorialStep', step: 'vote' })
        const view = await rooms.viewRoom(code, await fresh(me.id))
        expect(view.tutorial!.reached.map((r) => r.step)).toEqual([...TUTORIAL_STEPS])

        const done = await rooms.act(code, await fresh(me.id), { type: 'vote', vote: ANSWER })
        expect(done.phase).toBe('reveal')

        await new Promise((r) => setTimeout(r, 0))
        const events = write.mock.calls.flatMap(([batch]) => batch).filter((e) => e.props.code === code)
        expect(events.find((e) => e.name === 'case_start')?.props.tutorial).toBe(true)
        expect(events.filter((e) => e.name === 'tutorial_step').map((e) => e.props.step)).toEqual([...TUTORIAL_STEPS])
        expect(events.filter((e) => e.name === 'tutorial_done')).toHaveLength(1)
      } finally {
        write.mockRestore()
      }
    }))

  it('offers the tutorial only to players with no results, on its case, with the flag on', async () => {
    const me = await mkPlayer()
    expect(await rooms.isTutorial(me, TUTORIAL_CASE_ID)).toBe(false) // flag off
    await withTutorial(async () => {
      expect(await rooms.isTutorial(me, TUTORIAL_CASE_ID)).toBe(true)
      expect(await rooms.isTutorial(me, 'airdrop-of-doom')).toBe(false)
      await finishTutorial(me.id)
      expect(await rooms.isTutorial(me, TUTORIAL_CASE_ID)).toBe(false)
      const again = await rooms.createSolo(await fresh(me.id), TUTORIAL_CASE_ID)
      expect((await store().getRoom(again))?.tutorial).toBeUndefined()
    })
  })

  it('charges day-one cases for crews too, then refuses with nothing left', () =>
    withTutorial(async () => {
      const [host, a, b] = [await mkPlayer(), await mkPlayer(), await mkPlayer()]
      for (let i = 0; i < DAY_ONE_FREE_CASES; i++) {
        const code = await rooms.createRoom(await fresh(host.id), TUTORIAL_CASE_ID)
        for (const p of [a, b]) await rooms.act(code, await fresh(p.id), { type: 'join' })
        await rooms.act(code, await fresh(host.id), { type: 'start' })
      }
      expect(await fresh(host.id)).toMatchObject({ dayOneUsed: DAY_ONE_FREE_CASES, caseCredits: 0 })
      expect((await fresh(host.id)).freeCaseDay).toBeUndefined()
      await expect(rooms.createSolo(await fresh(host.id), TUTORIAL_CASE_ID)).rejects.toMatchObject({ code: 'NO_CASES' })
    }))

  it('gives an old player one free case with the flag on', () =>
    withTutorial(async () => {
      const old = await mkPlayer(Date.now() - 5 * DAY)
      expect((await publicPlayer(old)).freeCasesToday).toBe(1)
      await rooms.createSolo(await fresh(old.id), TUTORIAL_CASE_ID)
      expect((await publicPlayer(await fresh(old.id))).freeCasesToday).toBe(0)
      await expect(rooms.createSolo(await fresh(old.id), TUTORIAL_CASE_ID)).rejects.toMatchObject({ code: 'NO_CASES' })
    }))
})

describe('caseBoard nextCase', () => {
  async function saveCase(row: Partial<CaseRow> & { id: string; data: object }) {
    await store().saveCase({ district: 'memecoin-swamp', status: 'live', releaseAt: null, version: 1, ...row })
    resetCaseCache()
  }

  it('picks the newest released case, skips played ones, and is empty when all are played', async () => {
    const me = await mkPlayer()
    const now = Date.now()
    await saveCase({ id: 'swamp-older', releaseAt: now - 3 * DAY, data: { ...mooncat, id: 'swamp-older' } })
    await saveCase({ id: 'swamp-newer', releaseAt: now - DAY, data: { ...mooncat, id: 'swamp-newer' } })

    expect((await caseBoard(me, [], now)).nextCase).toEqual({ id: 'swamp-newer', startHere: false })
    expect((await caseBoard(me, [], now, TUTORIAL_CASE_ID)).nextCase).toEqual({ id: TUTORIAL_CASE_ID, startHere: true })
    expect((await caseBoard(me, ['swamp-newer'], now)).nextCase?.id).toBe('swamp-older')

    const board = await caseBoard(me, [], now)
    const open = board.cases.filter((c) => board.districts.find((d) => d.id === c.district)?.state === 'open').map((c) => c.id)
    expect((await caseBoard(me, open, now)).nextCase).toBeNull()
    // Locked districts carry their progress; Rookies start at 0.
    expect(board.districts.find((d) => d.id === 'sybil-square')?.unlock).toEqual({ have: 0, need: RANKS[1].at })
  })
})
