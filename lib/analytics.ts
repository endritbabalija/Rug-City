import 'server-only'
import { after } from 'next/server'
import { store } from './store'

/** Every product event we record. Add a name here before tracking it. */
export type EventName = 'app_open' | 'case_start' | 'case_finish' | 'purchase' | 'invite_joined' | 'ai_call' | 'dex_ask' | 'invite_sent' | 'tutorial_step' | 'tutorial_done'

/**
 * Record a product event in the `events` table. Inside a request the write runs after
 * the response is sent; outside one (tests, scripts) it runs straight away. Never throws.
 */
export function track(name: EventName, playerId: number | null, props: Record<string, unknown> = {}): void {
  const event = { name, playerId, props, at: Date.now() }
  const write = () => store().trackEvents([event]).catch((err) => console.error('Event write failed', name, err))
  try {
    after(write)
  } catch {
    // `after` throws outside a request scope.
    void write()
  }
}
