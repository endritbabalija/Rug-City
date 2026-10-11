import { describe, expect, it, vi } from 'vitest'

// Districts and the case repository, against the in-memory store.
vi.mock('@/lib/telegram/bot-api', () => ({ botApi: vi.fn(async () => true), miniAppLink: () => 'https://t.me/bot/app' }))

process.env.TELEGRAM_BOT_TOKEN = 'test-token'
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.ANTHROPIC_API_KEY

const { store } = await import('@/lib/store')
const rooms = await import('@/lib/rooms')
const { newPlayer } = await import('@/lib/player')
const { BUILT_IN_CASES, caseBoard, caseForRoom, getCase, listCases, resetCaseCache } = await import('@/lib/cases')
const { airdrop } = await import('@/lib/cases/airdrop')
const { mooncat } = await import('@/lib/cases/mooncat')
const { RANKS } = await import('@/lib/game/progress')
const { canPlay, DISTRICTS, districtById, districtState } = await import('@/lib/districts')
type CaseRow = import('@/lib/store/types').CaseRow

const DAY = 86_400_000
let nextId = 5000

async function mkPlayer(cluePoints = 0) {
  const id = nextId++
  await store().createPlayer(newPlayer({ id, name: `P${id}` }, Date.now()))
  return store().updatePlayer(id, (p) => ({ ...p, cluePoints }))
}

async function saveCase(row: Partial<CaseRow> & { id: string; data: object }) {
  await store().saveCase({ district: 'memecoin-swamp', status: 'live', releaseAt: null, version: 1, ...row })
  resetCaseCache()
}

const district = (id: string) => districtById(id)!

describe('districtState', () => {
  const expected: Record<string, string[]> = {
    Rookie: ['open', 'teaser', 'teaser', 'locked', 'locked', 'locked'],
    Inspector: ['open', 'open', 'teaser', 'locked', 'locked', 'locked'],
    Chief: ['open', 'open', 'open', 'locked', 'locked', 'locked'],
    Legend: ['open', 'open', 'open', 'open', 'open', 'open'],
  }

  it.each(RANKS.map((r) => [r.title, r.at] as const))('at %s', (title, at) => {
    const states = DISTRICTS.map((d) => districtState({ cluePoints: at }, d, BUILT_IN_CASES))
    expect(states).toEqual(expected[title])
  })

  it('opens exactly at the rank threshold', () => {
    expect(districtState({ cluePoints: RANKS[1].at - 1 }, district('sybil-square'))).toBe('locked')
    expect(districtState({ cluePoints: RANKS[1].at }, district('sybil-square'))).toBe('open')
  })

  it('keeps preview cases playable while their district is locked', () => {
    expect(canPlay({ cluePoints: 0 }, { district: 'sybil-square', preview: true })).toBe(true)
    expect(canPlay({ cluePoints: 0 }, { district: 'sybil-square' })).toBe(false)
    expect(canPlay({ cluePoints: 0 }, { district: 'memecoin-swamp' })).toBe(true)
  })

  it('places the built-ins as the defaults say', () => {
    const at = Object.fromEntries(BUILT_IN_CASES.map((c) => [c.id, [c.district, !!c.preview]]))
    expect(at).toEqual({
      'mooncat-exit': ['memecoin-swamp', false],
      'airdrop-of-doom': ['sybil-square', true],
      'audit-that-wasnt': ['defi-docks', true],
    })
  })
})

describe('hosting by district', () => {
  it('lets a Rookie host and play solo both teasers', async () => {
    const rookie = await mkPlayer()
    await expect(rooms.createRoom(rookie, 'airdrop-of-doom')).resolves.toMatch(/^[A-Z0-9]{5}$/)
    await expect(rooms.createSolo(rookie, 'audit-that-wasnt')).resolves.toMatch(/^[A-Z0-9]{5}$/)
  })

  it('rejects a non-teaser case in a locked district without charging, and allows it once open', async () => {
    await saveCase({ id: 'sybil-bots', district: 'sybil-square', data: { ...airdrop, id: 'sybil-bots', preview: false } })
    const rookie = await mkPlayer()
    await expect(rooms.createRoom(rookie, 'sybil-bots')).rejects.toMatchObject({ code: 'LOCKED', status: 403 })
    await expect(rooms.createSolo(rookie, 'sybil-bots')).rejects.toMatchObject({ code: 'LOCKED' })
    expect((await store().getPlayer(rookie.id))!.freeCaseDay).toBeUndefined()

    const inspector = await mkPlayer(RANKS[1].at)
    await expect(rooms.createRoom(inspector, 'sybil-bots')).resolves.toMatch(/^[A-Z0-9]{5}$/)
  })
})

describe('the case repository', () => {
  it('hides a case until its release time, and refuses to host it', async () => {
    const release = Date.now() + 3 * DAY
    await saveCase({ id: 'swamp-next', releaseAt: release, data: { ...mooncat, id: 'swamp-next' } })
    expect((await listCases()).map((c) => c.id)).not.toContain('swamp-next')
    expect(await getCase('swamp-next')).toBeUndefined()
    await expect(rooms.createRoom(await mkPlayer(), 'swamp-next')).rejects.toMatchObject({ code: 'UNKNOWN_CASE' })

    expect((await listCases(release)).map((c) => c.id)).toContain('swamp-next')
    expect((await getCase('swamp-next', release))?.title).toBe(mooncat.title)
  })

  it('takes a stored row over the built-in with the same id', async () => {
    await saveCase({ id: 'audit-that-wasnt', district: 'defi-docks', status: 'retired', data: { ...BUILT_IN_CASES[2], title: 'Retired audit' } })
    expect(await getCase('audit-that-wasnt')).toBeUndefined()
    expect((await listCases()).map((c) => c.id)).not.toContain('audit-that-wasnt')
    // A room that already started keeps its case.
    expect((await caseForRoom('audit-that-wasnt'))?.title).toBe('Retired audit')
    await store().saveCase({ ...(await store().getCaseRow('audit-that-wasnt'))!, status: 'live', version: 2 })
    resetCaseCache()
    expect((await getCase('audit-that-wasnt'))?.title).toBe('Retired audit')
  })

  it('skips a stored case that fails the schema', async () => {
    await saveCase({ id: 'broken-case', data: { ...mooncat, id: 'broken-case', suspects: 'nope' } })
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    expect(await getCase('broken-case')).toBeUndefined()
    expect((await listCases()).map((c) => c.id)).not.toContain('broken-case')
  })

  it('uses the row district over the one inside its data', async () => {
    await saveCase({ id: 'moved-case', district: 'defi-docks', data: { ...mooncat, id: 'moved-case' } })
    expect((await getCase('moved-case'))?.district).toBe('defi-docks')
  })
})

describe('caseBoard', () => {
  it('shows a Rookie one open and two teaser districts, with played state and the next drop date', async () => {
    const rookie = await mkPlayer()
    const now = Date.now()
    await saveCase({ id: 'swamp-later', releaseAt: now + 9 * DAY, data: { ...mooncat, id: 'swamp-later' } })
    const board = await caseBoard(rookie, ['mooncat-exit'], now)

    expect(board.districts.map((d) => [d.id, d.state])).toEqual([
      ['memecoin-swamp', 'open'],
      ['sybil-square', 'teaser'],
      ['defi-docks', 'teaser'],
    ])
    const ids = board.cases.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['mooncat-exit', 'airdrop-of-doom']))
    expect(ids).not.toContain('sybil-bots') // locked, not a preview
    expect(ids).not.toContain('swamp-later') // not released
    expect(board.cases.find((c) => c.id === 'mooncat-exit')).toMatchObject({ played: true, district: 'memecoin-swamp' })
    expect(board.cases.find((c) => c.id === 'airdrop-of-doom')).toMatchObject({ played: false, preview: true })
    // The earliest future case in an open district, as a date only.
    const first = (await store().getCaseRow('swamp-next'))!.releaseAt!
    expect(board.nextDrop).toBe(new Date(first).toISOString().slice(0, 10))
  })

  it('reads played cases from results', async () => {
    const p = await mkPlayer()
    await store().insertCaseResult({
      roomCode: 'PLAYD',
      playerId: p.id,
      caseId: 'mooncat-exit',
      mode: 'solo',
      seats: 1,
      correct: 3,
      score: 100,
      points: { culprit: 30, motive: 15, trail: 15, crew: 0, speed: 0, streak: 0 },
      total: 80,
      at: Date.now(),
    })
    expect(await store().playedCaseIds(p.id)).toEqual(['mooncat-exit'])
  })
})
