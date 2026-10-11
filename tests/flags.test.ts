import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.FLAGS

const { store, resetStore } = await import('@/lib/store')
const { flag, resetFlagCache } = await import('@/lib/flags')

beforeEach(() => {
  resetStore()
  resetFlagCache()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('flag', () => {
  it('is off when the flag has no row', async () => {
    expect(await flag('solo')).toBe(false)
  })

  it('reads the table at most every 30 s', async () => {
    vi.useFakeTimers()
    const read = vi.spyOn(store(), 'getFlags').mockResolvedValue({ solo: true })
    expect(await flag('solo')).toBe(true)
    read.mockResolvedValue({ solo: false })
    vi.advanceTimersByTime(29_000)
    expect(await flag('solo')).toBe(true)
    expect(await flag('daily')).toBe(false)
    expect(read).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1_000)
    expect(await flag('solo')).toBe(false)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('turns flags on from FLAGS', async () => {
    process.env.FLAGS = 'daily, solo'
    try {
      expect(await flag('solo')).toBe(true)
      expect(await flag('daily')).toBe(true)
      expect(await flag('districts')).toBe(false)
    } finally {
      delete process.env.FLAGS
    }
  })

  it('is off when the table cannot be read, and tries again next time', async () => {
    const read = vi.spyOn(store(), 'getFlags').mockRejectedValue(new Error('relation "feature_flags" does not exist'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await flag('solo')).toBe(false)
    read.mockResolvedValue({ solo: true })
    expect(await flag('solo')).toBe(true)
  })
})
