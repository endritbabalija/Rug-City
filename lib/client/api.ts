'use client'

import { webApp } from '../telegram/webapp'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const DEV_KEY = 'who-rugged:dev-user'

/**
 * Outside Telegram (local dev only) each browser tab plays as its own fake user:
 * open `/?dev=1&name=Ana` in one tab and `/?dev=2&name=Ben` in another.
 */
function devIdentity(): string {
  const q = new URLSearchParams(window.location.search)
  const fromUrl = q.get('dev')
  if (fromUrl) {
    const id = `${Number(fromUrl) || 1}:${encodeURIComponent(q.get('name') ?? `Detective ${fromUrl}`)}`
    sessionStorage.setItem(DEV_KEY, id)
    return id
  }
  const saved = sessionStorage.getItem(DEV_KEY)
  if (saved) return saved
  const n = Math.floor(1000 + Math.random() * 9000)
  const id = `${n}:${encodeURIComponent(`Detective ${n}`)}`
  sessionStorage.setItem(DEV_KEY, id)
  return id
}

export function isTelegram() {
  return !!webApp()
}

function authHeader() {
  const wa = webApp()
  return wa ? `tma ${wa.initData}` : `dev ${devIdentity()}`
}

/** Room code the app was opened with: Telegram's start_param, or ?room= in the browser. */
export function launchRoomCode(): string | null {
  const raw = webApp()?.initDataUnsafe.start_param ?? new URLSearchParams(window.location.search).get('room')
  return raw && /^[A-Za-z0-9]{5}$/.test(raw) ? raw.toUpperCase() : null
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: authHeader() }
  const start = launchRoomCode()
  if (start) headers['x-start-param'] = start
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error?.code ?? 'NETWORK', json.error?.message ?? 'Network error, try again.', res.status)
  return json as T
}
