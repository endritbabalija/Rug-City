import 'server-only'
import { env } from '../env'
import { createMemoryStore } from './memory'
import { createSupabaseStore } from './supabase'
import type { Store } from './types'

const g = globalThis as unknown as { __whoRuggedStore?: Store }

export function store(): Store {
  if (!g.__whoRuggedStore) {
    const { supabaseUrl, supabaseServiceKey } = env()
    g.__whoRuggedStore =
      supabaseUrl && supabaseServiceKey ? createSupabaseStore(supabaseUrl, supabaseServiceKey) : createMemoryStore()
  }
  return g.__whoRuggedStore
}

export type { Store, Purchase } from './types'
