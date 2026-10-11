import { afterEach, describe, expect, it, vi } from 'vitest'

delete process.env.NEXT_PUBLIC_SUPABASE_URL

const { store, resetStore } = await import('@/lib/store')
const { track } = await import('@/lib/analytics')

// Outside a request `track` writes straight away, but still without awaiting it.
const settle = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  vi.restoreAllMocks()
  resetStore()
})

describe('track', () => {
  it('writes the event to the store', async () => {
    const write = vi.spyOn(store(), 'trackEvents')
    track('app_open', 7, { startParam: 'K7Q2M' })
    await settle()
    expect(write).toHaveBeenCalledWith([{ name: 'app_open', playerId: 7, props: { startParam: 'K7Q2M' }, at: expect.any(Number) }])
  })

  it('never throws when the store fails', async () => {
    vi.spyOn(store(), 'trackEvents').mockRejectedValue(new Error('relation "events" does not exist'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => track('case_start', null)).not.toThrow()
    await settle()
    expect(err).toHaveBeenCalledWith('Event write failed', 'case_start', expect.any(Error))
  })
})
