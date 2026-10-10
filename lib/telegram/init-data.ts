// Validates Telegram Mini App init data on the server, per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//   secret = HMAC_SHA256(key = "WebAppData", msg = bot_token)
//   hash   = hex(HMAC_SHA256(key = secret, msg = data_check_string))
// where data_check_string is every field except `hash`, sorted by key, as "key=value" joined by "\n".

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface InitData {
  user: TelegramUser
  authDate: number
  startParam?: string
  chatInstance?: string
  chatType?: string
}

export class InitDataError extends Error {}

/** Max age of init data before we ask the client to reopen the app. */
export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60

export function signInitData(params: URLSearchParams, botToken: string): string {
  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  return createHmac('sha256', secret).update(dataCheckString).digest('hex')
}

export function validateInitData(raw: string, botToken: string, nowSec = Math.floor(Date.now() / 1000)): InitData {
  if (!botToken) throw new InitDataError('Bot token is not configured')
  const params = new URLSearchParams(raw)
  const hash = params.get('hash')
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw new InitDataError('Missing or malformed hash')

  const expected = Buffer.from(signInitData(params, botToken), 'hex')
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new InitDataError('Signature mismatch')

  const authDate = Number(params.get('auth_date'))
  if (!authDate) throw new InitDataError('Missing auth_date')
  if (nowSec - authDate > INIT_DATA_MAX_AGE_SEC) throw new InitDataError('Init data expired')

  const userRaw = params.get('user')
  if (!userRaw) throw new InitDataError('Missing user')
  let user: TelegramUser
  try {
    user = JSON.parse(userRaw)
  } catch {
    throw new InitDataError('Malformed user')
  }
  if (typeof user?.id !== 'number') throw new InitDataError('Malformed user')

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? undefined,
    chatInstance: params.get('chat_instance') ?? undefined,
    chatType: params.get('chat_type') ?? undefined,
  }
}

export function displayName(u: Pick<TelegramUser, 'first_name' | 'last_name' | 'username'>) {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return (full || u.username || 'Detective').slice(0, 32)
}
