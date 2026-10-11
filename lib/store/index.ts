import 'server-only'
import { env } from '../env'
import { createMemoryStore } from './memory'
import { createSupabaseStore } from './supabase'
import type { Store } from './types'

const g = globalThis as unknown as { __rugCityStore?: Store }

export function store(): Store {
  if (!g.__rugCityStore) {
    const { supabaseUrl, supabaseServiceKey } = env()
    g.__rugCityStore =
      supabaseUrl && supabaseServiceKey ? createSupabaseStore(supabaseUrl, supabaseServiceKey) : createMemoryStore()
  }
  return g.__rugCityStore
}

/** Tests only: drop the store so the next `store()` call builds a fresh one. */
export function resetStore() {
  delete g.__rugCityStore
}

export type { Store, AppEvent } from './types'
