// Checks that .env.local points at a Supabase project with the Who Rugged? schema.
// Usage: node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !service || !anon) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

let ok = true
const admin = createClient(url, service, { auth: { persistSession: false } })
for (const table of ['players', 'rooms', 'purchases']) {
  const { error } = await admin.from(table).select('*', { head: true, count: 'exact' })
  if (error) {
    ok = false
    console.error(`✗ ${table}: ${error.message}`)
  } else console.log(`✓ ${table} exists`)
}

// The anon key must NOT be able to read game data (RLS on, no policies).
const pub = createClient(url, anon, { auth: { persistSession: false } })
const { data, error } = await pub.from('rooms').select('code').limit(1)
if (error || (data && data.length === 0)) console.log('✓ anon key cannot read rooms')
else {
  ok = false
  console.error('✗ anon key can read rooms: row level security is off')
}

// Realtime broadcast over REST, which the server uses to ping clients.
const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
  method: 'POST',
  headers: { apikey: service, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ topic: 'room:CHECK', event: 'update', payload: { version: 0 }, private: false }] }),
})
if (res.ok) console.log('✓ realtime broadcast works')
else {
  ok = false
  console.error(`✗ realtime broadcast: HTTP ${res.status} ${await res.text()}`)
}

console.log(ok ? '\nSupabase is ready.' : '\nFix the ✗ items above.')
process.exit(ok ? 0 : 1)
