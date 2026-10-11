import { afterEach, describe, expect, it } from 'vitest'

delete process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.DEV_AUTH = '1'

const { store, resetStore } = await import('@/lib/store')
const { GET } = await import('@/app/api/me/route')
const { POST: webhook } = await import('@/app/api/telegram/webhook/route')

afterEach(() => resetStore())

const me = (auth?: string) => GET(new Request('http://test/api/me', { headers: auth ? { authorization: auth } : {} }), undefined as never)

describe('/api/me', () => {
  it('creates the player on first visit and returns only public fields', async () => {
    const res = await me('dev 7:Ana')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ player: { id: 7, name: 'Ana' } })
    expect((await store().getPlayer(7))?.name).toBe('Ana')
  })

  it('keeps the player and updates a changed name', async () => {
    await me('dev 7:Ana')
    const created = (await store().getPlayer(7))!.createdAt
    await me('dev 7:Ana%20B')
    const p = (await store().getPlayer(7))!
    expect(p.name).toBe('Ana B')
    expect(p.createdAt).toBe(created)
  })

  it('rejects a request without valid auth', async () => {
    expect((await me()).status).toBe(401)
    expect((await me('tma user=forged&hash=00')).status).toBe(401)
  })
})

describe('Telegram webhook', () => {
  it('rejects updates without the secret', async () => {
    const res = await webhook(new Request('http://test/api/telegram/webhook', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })
})
