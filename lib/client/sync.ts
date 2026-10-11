import type { CaseMode } from '../game/types'

/** Crew rooms poll slowly while Realtime pushes updates, fast when it's down. */
export const POLL_LIVE_MS = 30_000
export const POLL_FALLBACK_MS = 4000

/**
 * How often a room refetches itself, or null for never. Solo rooms don't poll: only the
 * player changes them, and every action response already carries the fresh room.
 */
export function pollMs(mode: CaseMode, realtimeLive: boolean): number | null {
  if (mode === 'solo') return null
  return realtimeLive ? POLL_LIVE_MS : POLL_FALLBACK_MS
}
