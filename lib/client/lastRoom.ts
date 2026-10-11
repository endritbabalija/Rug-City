'use client'

// The case this player last had open, so Home can offer a way back into it. Browser storage
// can be missing or blocked (private windows, some Telegram clients), so every access is guarded.

const KEY = 'who-rugged:last-room'

export function lastRoom(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Remember `code`, or forget it with null. */
export function rememberRoom(code: string | null) {
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch {
    // Nothing to do: Home just won't show the banner.
  }
}

/** Forget `code` if it's the one remembered. */
export function forgetRoom(code: string) {
  if (lastRoom() === code) rememberRoom(null)
}
