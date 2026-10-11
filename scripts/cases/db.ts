// The shared Supabase project, through the same Store the app uses. Script-only.

import { createSupabaseStore } from '../../lib/store/supabase'
import { BUILT_INS } from './builtins'

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).')
  return createSupabaseStore(url, key)
}

/** Every case id in use, stored or built in. */
export async function takenIds(store: ReturnType<typeof db>) {
  return new Set([...(await store.listCaseMeta()).map((m) => m.id), ...BUILT_INS.map((c) => c.id)])
}

/** `base`, or `base-2`, `base-3`… if that's taken. */
export function freeId(base: string, taken: Set<string>) {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'case'
  let id = clean
  for (let n = 2; taken.has(id); n++) id = `${clean}-${n}`
  return id
}
