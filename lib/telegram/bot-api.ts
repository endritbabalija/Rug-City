import 'server-only'
import { env } from '../env'

export class BotApiError extends Error {
  constructor(
    public method: string,
    public description: string,
  ) {
    super(`Telegram ${method}: ${description}`)
  }
}

export async function botApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const { botToken } = env()
  if (!botToken) throw new BotApiError(method, 'TELEGRAM_BOT_TOKEN is not set')
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
  if (!json.ok) throw new BotApiError(method, json.description ?? `HTTP ${res.status}`)
  return json.result as T
}

/** https://t.me/<bot>/<app>?startapp=<param>: opens the Mini App directly, in DMs and groups. */
export function miniAppLink(startParam?: string) {
  const { botUsername, appShortName } = env()
  const base = `https://t.me/${botUsername}/${appShortName}`
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base
}
