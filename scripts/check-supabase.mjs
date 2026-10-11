// Checks that .env.local points at a Supabase project with the Rug City schema.
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
for (const table of ['players', 'events', 'feature_flags']) {
  const { error } = await admin.from(table).select('*', { head: true, count: 'exact' })
  if (error) {
    ok = false
    console.error(`✗ ${table}: ${error.message}`)
  } else console.log(`✓ ${table} exists`)
}

// The anon key must NOT be able to read game data (RLS on, no policies).
const pub = createClient(url, anon, { auth: { persistSession: false } })
const { data, error } = await pub.from('players').select('id').limit(1)
if (error || (data && data.length === 0)) console.log('✓ anon key cannot read players')
else {
  ok = false
  console.error('✗ anon key can read players: row level security is off')
}

console.log(ok ? '\nSupabase is ready.' : '\nFix the ✗ items above.')
process.exit(ok ? 0 : 1)
