import { describe, expect, it } from 'vitest'
import { InitDataError, signInitData, validateInitData } from '@/lib/telegram/init-data'

const TOKEN = '123456:TEST-token'
const NOW = 1_800_000_000

function makeInitData(fields: Record<string, string>, token = TOKEN) {
  const params = new URLSearchParams(fields)
  params.set('hash', signInitData(params, token))
  return params.toString()
}

const user = JSON.stringify({ id: 42, first_name: 'Ana', username: 'ana' })

describe('validateInitData', () => {
  it('accepts correctly signed data and parses it', () => {
    const raw = makeInitData({ user, auth_date: String(NOW - 60), start_param: 'K7Q2M', query_id: 'AAE' })
    const data = validateInitData(raw, TOKEN, NOW)
    expect(data.user.id).toBe(42)
    expect(data.startParam).toBe('K7Q2M')
  })

  it('includes every non-hash field in the check, including signature', () => {
    const raw = makeInitData({ user, auth_date: String(NOW), signature: 'abc' })
    expect(() => validateInitData(raw, TOKEN, NOW)).not.toThrow()
    const tampered = raw.replace('signature=abc', 'signature=abd')
    expect(() => validateInitData(tampered, TOKEN, NOW)).toThrow(InitDataError)
  })

  it('rejects tampered user data', () => {
    const raw = makeInitData({ user, auth_date: String(NOW) })
    const forged = raw.replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":43'))
    expect(forged).not.toBe(raw)
    expect(() => validateInitData(forged, TOKEN, NOW)).toThrow(InitDataError)
  })

  it('rejects data signed with another bot token', () => {
    const raw = makeInitData({ user, auth_date: String(NOW) }, '999:other')
    expect(() => validateInitData(raw, TOKEN, NOW)).toThrow(InitDataError)
  })

  it('rejects stale data', () => {
    const raw = makeInitData({ user, auth_date: String(NOW - 2 * 24 * 3600) })
    expect(() => validateInitData(raw, TOKEN, NOW)).toThrow(/expired/)
  })

  it('rejects missing or malformed hashes', () => {
    expect(() => validateInitData(`user=${encodeURIComponent(user)}&auth_date=${NOW}`, TOKEN, NOW)).toThrow(InitDataError)
    expect(() => validateInitData(`user=${encodeURIComponent(user)}&auth_date=${NOW}&hash=zz`, TOKEN, NOW)).toThrow(InitDataError)
  })
})
