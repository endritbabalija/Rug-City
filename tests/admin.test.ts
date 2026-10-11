import { describe, expect, it, vi } from 'vitest'

// Admin case review and playtests, against the in-memory store with dev logins.
vi.mock('@/lib/telegram/bot-api', () => ({ botApi: vi.fn(async () => true), miniAppLink: () => 'https://t.me/bot/app' }))

process.env.TELEGRAM_BOT_TOKEN = 'test-token'
process.env.DEV_AUTH = '1'
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.ANTHROPIC_API_KEY

const ADMIN = 7001
process.env.ADMIN_TELEGRAM_IDS = String(ADMIN)

const { store } = await import('@/lib/store')
const rooms = await import('@/lib/rooms')
const { getCase, listCases, resetCaseCache } = await import('@/lib/cases')
const { mooncat } = await import('@/lib/cases/mooncat')
const list = await import('@/app/api/admin/cases/route')
const one = await import('@/app/api/admin/cases/[id]/route')
const me = await import('@/app/api/me/route')

const DAY = 86_400_000
let nextId = 7100

const req = (as: number, path: string, body?: unknown) =>
  new Request(`http://test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `dev ${as}:Tester`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

async function reviewCase(id: string) {
  await store().saveCase({ id, district: 'memecoin-swamp', status: 'review', releaseAt: null, version: 1, data: { ...mooncat, id, review: { passed: true } } })
  resetCaseCache()
}

describe('admin routes', () => {
  it('return 403 for players who are not admins', async () => {
    const id = nextId++
    await reviewCase('admin-guarded')
    expect((await list.GET(req(id, '/api/admin/cases'), undefined as never)).status).toBe(403)
    expect((await one.GET(req(id, '/api/admin/cases/admin-guarded'), ctx('admin-guarded'))).status).toBe(403)
    for (const body of [{ action: 'approve', releaseAt: Date.now(), targetSec: 900 }, { action: 'reject' }, { action: 'playtest' }])
      expect((await one.POST(req(id, '/api/admin/cases/admin-guarded', body), ctx('admin-guarded'))).status).toBe(403)
    expect((await store().getCaseRow('admin-guarded'))!.status).toBe('review')
  })

  it('tell the client who is an admin', async () => {
    expect(((await (await me.GET(req(ADMIN, '/api/me'), undefined as never)).json()) as { isAdmin: boolean }).isAdmin).toBe(true)
    expect(((await (await me.GET(req(nextId++, '/api/me'), undefined as never)).json()) as { isAdmin: boolean }).isAdmin).toBe(false)
  })

  it('list cases in review and approve one into Memecoin Swamp at its release time', async () => {
    await reviewCase('admin-approve')
    const listed = (await (await list.GET(req(ADMIN, '/api/admin/cases?status=review'), undefined as never)).json()) as { cases: { id: string }[] }
    expect(listed.cases.map((c) => c.id)).toContain('admin-approve')
    expect(await getCase('admin-approve')).toBeUndefined()

    const releaseAt = Date.now() + DAY
    const res = await one.POST(req(ADMIN, '/api/admin/cases/admin-approve', { action: 'approve', releaseAt, targetSec: 1200 }), ctx('admin-approve'))
    expect(res.status).toBe(200)
    const row = (await store().getCaseRow('admin-approve'))!
    expect(row).toMatchObject({ status: 'live', releaseAt, version: 2 })
    expect((row.data as { targetSec: number }).targetSec).toBe(1200)

    expect((await listCases()).map((c) => c.id)).not.toContain('admin-approve')
    const live = await getCase('admin-approve', releaseAt)
    expect(live).toMatchObject({ district: 'memecoin-swamp', targetSec: 1200 })
  })

  it('reject a case into retired, and refuse to approve it after', async () => {
    await reviewCase('admin-reject')
    const res = await one.POST(req(ADMIN, '/api/admin/cases/admin-reject', { action: 'reject', reason: 'Too easy' }), ctx('admin-reject'))
    expect(res.status).toBe(200)
    const row = (await store().getCaseRow('admin-reject'))!
    expect(row.status).toBe('retired')
    expect((row.data as { review: { rejected: { reason: string } } }).review.rejected.reason).toBe('Too easy')
    const again = await one.POST(req(ADMIN, '/api/admin/cases/admin-reject', { action: 'approve', releaseAt: Date.now(), targetSec: 900 }), ctx('admin-reject'))
    expect(again.status).toBe(409)
  })
})

describe('playtests', () => {
  it('charge nothing and write no result, even for a case still in review', async () => {
    await reviewCase('admin-playtest')
    await store().createPlayer({ ...(await import('@/lib/player')).newPlayer({ id: ADMIN, name: 'Admin' }, Date.now()) })
    const before = (await store().getPlayer(ADMIN))!

    const res = await one.POST(req(ADMIN, '/api/admin/cases/admin-playtest', { action: 'playtest' }), ctx('admin-playtest'))
    const { code } = (await res.json()) as { code: string }
    expect(res.status).toBe(200)
    const admin = (await store().getPlayer(ADMIN))!
    expect(admin.caseCredits).toBe(before.caseCredits)
    expect(admin.freeCaseDay).toBe(before.freeCaseDay)

    await rooms.act(code, admin, { type: 'ready' })
    await rooms.act(code, admin, { type: 'callVote' })
    const done = await rooms.act(code, admin, { type: 'vote', vote: mooncat.answer })
    expect(done).toMatchObject({ phase: 'reveal', playtest: true, awards: {} })
    expect((await rooms.viewRoom(code, admin)).playtest).toBe(true)

    expect(await store().recentResults(ADMIN, 5)).toEqual([])
    expect(await store().getCaseStats('admin-playtest', 'solo')).toBeNull()
    const after = (await store().getPlayer(ADMIN))!
    expect(after.cluePoints ?? 0).toBe(before.cluePoints ?? 0)
  })

  it('are admin-only even when called directly', async () => {
    const id = nextId++
    await store().createPlayer((await import('@/lib/player')).newPlayer({ id, name: 'P' }, Date.now()))
    await expect(rooms.createPlaytest((await store().getPlayer(id))!, 'mooncat-exit')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })
})
