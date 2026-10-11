// Playtest readout for The Refund (brief §11): one block per run, in the order things happened,
// with wrong tries, hints and where an unfinished player stopped. Read-only.
// Usage: npm run playtest:readout -- [--since 2026-10-12] [--player <telegram id>] [--include-dev]
import { createClient } from '@supabase/supabase-js'

const CASE_ID = 'the-refund'
const DEFAULT_DAYS = 7
// Local dev with Supabase vars plays as fake users on ids below this (docs/ops/environments.md).
const DEV_ID_LIMIT = 1000
const HINT_LEVELS = ['nudge', 'direction', 'explicit help']
const PAGE = 1000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
const since = arg('since') ? new Date(arg('since')) : new Date(Date.now() - DEFAULT_DAYS * 86_400_000)
const onlyPlayer = arg('player') ? Number(arg('player')) : null
const includeDev = args.includes('--include-dev')
if (Number.isNaN(since.getTime())) {
  console.error('✗ --since must be a date, e.g. 2026-10-12')
  process.exit(1)
}

// Authored content, so the readout can name things instead of printing ids.
const { THE_REFUND_V1 } = await import('../lib/investigation/cases/refund.ts')
const CASES = { 1: THE_REFUND_V1 }

function names(def) {
  const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]))
  return {
    evidence: by(def.evidence),
    people: by(def.people),
    statements: by(def.statements),
    topics: by(def.topics),
    claims: by(def.claims),
    challenges: by(def.challenges),
    hints: by(def.hints),
  }
}

const admin = createClient(url, key, { auth: { persistSession: false } })

async function all(query) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

let runs = await all(() =>
  admin
    .from('investigation_runs')
    .select('id, player_id, case_version, status, doc, created_at, updated_at, resolved_at')
    .eq('case_id', CASE_ID)
    .gte('updated_at', since.toISOString())
    .order('created_at'),
)
runs = runs.filter((r) => (onlyPlayer ? r.player_id === onlyPlayer : includeDev || r.player_id >= DEV_ID_LIMIT))

const day = since.toISOString().slice(0, 10)
if (!runs.length) {
  // No process.exit here: on Windows it can abort while the client's sockets are closing.
  console.log(`No runs of The Refund active since ${day}${includeDev ? '' : ' (dev ids hidden, --include-dev shows them)'}.`)
} else await readout()

async function readout() {
  const runIds = new Set(runs.map((r) => r.id))
  const events = (
    await all(() =>
      admin
        .from('events')
        .select('name, player_id, props, at')
        .in('player_id', [...new Set(runs.map((r) => r.player_id))])
        .gte('at', new Date(Math.min(...runs.map((r) => Date.parse(r.created_at)))).toISOString())
        .order('at'),
    )
  ).filter((e) => runIds.has(e.props?.runId))

  const { data: players, error } = await admin
    .from('players')
    .select('id, name, username')
    .in('id', [...new Set(runs.map((r) => r.player_id))])
  if (error) throw new Error(error.message)
  const playerById = Object.fromEntries(players.map((p) => [p.id, p]))
  const admins = new Set((process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((s) => Number(s.trim())))

  const clock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  const minutes = (ms) => `${Math.round(ms / 60_000)}m`
  const when = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const quote = (s) => `“${s}”`

  const totals = { runs: 0, solved: 0, solveMs: [], stops: {}, wrongClaims: {}, wrongAccused: {}, hintSteps: {} }
  const bump = (obj, k) => (obj[k] = (obj[k] ?? 0) + 1)

  for (const run of runs) {
    const def = CASES[run.case_version]
    if (!def) {
      console.log(`\n━━ run ${run.id.slice(0, 8)}: case version ${run.case_version} unknown to this script, skipped`)
      continue
    }
    const n = names(def)
    const p = run.doc
    const start = Date.parse(run.created_at)
    const title = (id) => n.evidence[id]?.title ?? id
    const personOf = (statementId) => n.people[n.statements[statementId]?.person]?.name ?? '?'

    // One timeline from events plus the run's own conversation timestamps (topics aren't events).
    const lines = []
    const add = (at, text) => lines.push({ at, text })
    for (const e of events.filter((x) => x.props.runId === run.id)) {
      const at = Date.parse(e.at)
      const pr = e.props
      switch (e.name) {
        case 'investigation_started':
          add(at, pr.restart ? 'started over (new run)' : 'started')
          break
        case 'investigation_resumed':
          add(at, `came back (${pr.status})`)
          break
        case 'evidence_opened':
          add(at, `opened ${title(pr.evidence)}`)
          break
        case 'finding_attempted':
          if (!pr.ok) {
            add(at, `✗ tried ${quote(n.claims[pr.claim]?.text ?? pr.claim)} with ${pr.evidence.map(title).join(' + ')}`)
            bump(totals.wrongClaims, n.claims[pr.claim]?.text ?? pr.claim)
          }
          break
        case 'finding_established':
          add(at, `✓ PROVED ${quote(n.claims[pr.finding]?.text ?? pr.finding)}`)
          break
        case 'confrontation_attempted':
          if (!pr.ok) add(at, `✗ challenged ${personOf(n.challenges[pr.challenge]?.statement)}: ${quote(n.challenges[pr.challenge]?.text ?? pr.challenge)}`)
          break
        case 'confrontation_resolved':
          add(at, `✓ BROKE ${personOf(n.challenges[pr.confrontation]?.statement)}'s story: ${quote(n.challenges[pr.confrontation]?.text ?? pr.confrontation)}`)
          break
        case 'hint_requested':
          add(at, `? hint, ${n.hints[pr.step]?.title ?? pr.step}: ${HINT_LEVELS[pr.level - 1] ?? `level ${pr.level}`}`)
          bump(totals.hintSteps, n.hints[pr.step]?.title ?? pr.step)
          break
        case 'accusation_submitted': {
          const who = n.people[pr.suspect]?.name ?? pr.suspect
          add(at, pr.ok ? `✓ ACCUSED ${who}: case solved` : `✗ accused ${who} (theory didn't hold)`)
          if (!pr.ok) bump(totals.wrongAccused, who)
          break
        }
      }
    }
    for (const t of p.transcript) {
      const topic = n.topics[t.key]
      if (topic) add(t.at, `asked ${n.people[topic.person]?.name ?? topic.person}: ${topic.label}`)
    }
    lines.sort((a, b) => a.at - b.at)

    const completed = events.find((e) => e.props.runId === run.id && e.name === 'investigation_completed')
    const lastAt = Math.max(Date.parse(run.updated_at), ...lines.map((l) => l.at))
    const wrong = lines.filter((l) => l.text.startsWith('✗')).length
    const hints = Object.values(p.hints).reduce((a, b) => a + b, 0)
    const findings = p.findings.map((f) => f.id).filter((id) => n.claims[id]?.support)
    const meets = (req) =>
      (req.evidence ?? []).every((x) => p.evidence.includes(x)) &&
      (req.findings ?? []).every((x) => p.findings.some((f) => f.id === x)) &&
      (req.confrontations ?? []).every((x) => p.confrontations.includes(x)) &&
      (req.topics ?? []).every((x) => p.topics.includes(x))

    const who = playerById[run.player_id]
    const label = [who?.name ?? 'Unknown', who?.username && `@${who.username}`, run.player_id, admins.has(run.player_id) && 'admin'].filter(Boolean).join(' · ')
    console.log(`\n━━ ${label} · run ${run.id.slice(0, 8)} · started ${when(start)}`)

    totals.runs++
    if (run.status === 'resolved') {
      const wall = Date.parse(run.resolved_at) - start
      totals.solved++
      totals.solveMs.push(wall)
      const active = completed?.props.activeMs
      console.log(`SOLVED in ${minutes(wall)}${active ? ` (${minutes(active)} on screen)` : ''} · ${hints} hints · ${wrong} wrong tries`)
    } else {
      const step = def.hints.find((h) => !meets(h.done))
      const stuck = run.status === 'intro' ? 'never opened the case' : (step?.title ?? 'ready to accuse')
      bump(totals.stops, stuck)
      console.log(
        `NOT SOLVED · stopped at: ${stuck} · last active ${when(lastAt)} (${minutes(Date.now() - lastAt)} ago) · ${hints} hints · ${wrong} wrong tries`,
      )
    }
    console.log(
      `Records ${p.evidence.length}/${def.evidence.length} · findings ${findings.length}/${def.claims.filter((c) => c.support).length} · confrontations ${p.confrontations.length}`,
    )
    if (p.leads.length) console.log(`Leads followed (no time recorded): ${p.leads.map((l) => def.leads.find((x) => x.id === l)?.label ?? l).join('; ')}`)
    console.log('')
    for (const l of lines) console.log(`  +${clock(l.at - start).padStart(6)}  ${l.text}`)
  }

  if (totals.runs > 1) {
    const sorted = [...totals.solveMs].sort((a, b) => a - b)
    const top = (obj) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${v}× ${k}`)
    console.log(`\n━━ Across ${totals.runs} runs since ${day}`)
    console.log(`Solved ${totals.solved}/${totals.runs}${sorted.length ? ` · median ${minutes(sorted[Math.floor(sorted.length / 2)])}` : ''}`)
    for (const [heading, obj] of [
      ['Stopped at', totals.stops],
      ['Hints asked for', totals.hintSteps],
      ['Wrong claims', totals.wrongClaims],
      ['Wrong accusations', totals.wrongAccused],
    ])
      if (Object.keys(obj).length) console.log(`${heading}: ${top(obj).join(' · ')}`)
  }
}
