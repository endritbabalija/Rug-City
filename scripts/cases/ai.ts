// Model calls for the case pipeline (docs/archive/phase-1/06-case-pipeline.md): drafting a case
// and the blind solver. Script-only: imports nothing marked 'server-only'.

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { SEAT_COUNTS, staticProblems, suggestTargetSec, type CaseReview, type Question, type SolverRun } from '../../lib/cases/checks'
import { caseSchema } from '../../lib/cases/schema'
import type { CaseFile } from '../../lib/cases/types'
import type { District } from '../../lib/districts'
import { dealClues } from '../../lib/game/engine'

export const CASE_MODEL = process.env.CASE_MODEL || 'claude-opus-5-5'
export const SOLVER_MODEL = process.env.SOLVER_MODEL || 'claude-opus-5-5'

/** How many drafts to retry with the validation errors before giving up on one case. */
const DRAFT_RETRIES = 3
/** Every solver check runs this many times, and must pass every time. */
const SOLVER_RUNS = 2
const SOLVER_PARALLEL = 6

let client: Anthropic | null = null
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (add it to .env.local).')
  // Keys that aren't scoped to a workspace need the workspace named on every request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID
  client ??= new Anthropic({ timeout: 20 * 60_000, maxRetries: 3, ...(workspace && { defaultHeaders: { 'anthropic-workspace-id': workspace } }) })
  return client
}

// ── Spend ──────────────────────────────────────────────────────────────────

/** Rough $ per million tokens, for the running cost line only. */
const PRICE: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

/** Models that take the server-side refusal fallback; Haiku doesn't. */
const takesFallback = (model: string) => /^claude-(opus|sonnet|fable)-/.test(model)
let spentUsd = 0
function addUsage(model: string, u: Anthropic.Beta.BetaUsage) {
  const p = PRICE[model] ?? PRICE['claude-opus-5-5']
  spentUsd +=
    ((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1e6
}
export const spent = () => spentUsd

/**
 * One call that returns JSON. Streams (drafts are long) and falls back on a refusal
 * (server-side `fallbacks: 'default'`, where the model takes it). With `schema` the API
 * enforces the shape; without it (the case file is too big a grammar for structured
 * outputs) the model writes plain JSON and the caller validates it.
 */
async function structured(opts: {
  model: string
  system: Anthropic.Beta.BetaTextBlockParam[]
  user: string
  schema?: z.ZodType
  effort: 'medium' | 'high' | 'xhigh'
  maxTokens: number
}): Promise<unknown> {
  const format = opts.schema ? zodOutputFormat(opts.schema) : null
  const stream = anthropic().beta.messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens,
    ...(takesFallback(opts.model) && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    output_config: { effort: opts.effort, ...(format && { format: { type: format.type, schema: format.schema } }) },
  })
  const msg = await stream.finalMessage()
  addUsage(opts.model, msg.usage)
  if (msg.stop_reason === 'refusal') throw new Error(`Model refused (${msg.stop_details?.category ?? 'no category'})`)
  if (msg.stop_reason === 'max_tokens') throw new Error('Output hit max_tokens')
  const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  if (format) return JSON.parse(text)
  // Plain JSON may come wrapped in a code fence or a sentence: take the outermost object.
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON object in the reply')
  return JSON.parse(text.slice(start, end + 1))
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
}

// ── Drafting ───────────────────────────────────────────────────────────────

function strip(c: CaseFile) {
  const rest: Partial<CaseFile> = { ...c }
  delete rest.district
  delete rest.preview
  delete rest.targetSec
  return rest
}

function draftSystem(examples: CaseFile[]): Anthropic.Beta.BetaTextBlockParam[] {
  // Run from the repo root (npm scripts do), so the field docs stay in sync with the code.
  const types = readFileSync('lib/cases/types.ts', 'utf8')
  const text = `You write cases for "Who Rugged?", a detective party game inside Telegram. A crypto project just got rugged; a crew of 3 to 6 friends (or one player with an AI partner) has about 15 to 20 minutes to work out WHO did it, WHY (motive) and WHERE THE MONEY WENT (trail). Each player is dealt different clues, suspects send each player private messages, and everyone shares a blockchain explorer of the case's wallets and transactions.

## How a case plays
- Everyone reads the briefing and timeline.
- Clues are dealt round-robin to seats in \`dealOrder\`. With 3 to 6 seats, no single player may ever hold a full \`culpritProofs\` set: the crew has to talk. Put the clues of each proof next to each other in \`dealOrder\` so they land on different seats.
- Each player chats live with one or two suspects, played by a model that knows each suspect's \`truth\` and \`lies\`. Suspects lie to protect themselves and only slip when pressed with specific evidence. A Subpoena forces one truthful answer.
- The explorer shows every wallet and transaction. \`fundingHidden\` wallets hide who funded them until a player pays for a Trace.
- At the end the crew votes on culprit, motive and trail from the multiple-choice \`motives\` and \`trails\`.

## What makes a good case
- 5 suspects: the culprit and at least two red herrings whose behaviour looks suspicious but has an innocent explanation that the evidence or their truth confirms.
- 10 to 12 clues mixing kinds (chat, post, code, multisig, doc). Each clue is a believable artefact: a group chat excerpt, a deleted post, a commit, a multisig vote, a bank-style statement.
- The culprit is provable only by combining at least two clues held by different players, plus the explorer.
- Interrogation is required: at least one of motive or trail (or the culprit) must be impossible to pin down from the clues and explorer alone. The decisive fact is something a suspect only gives up under questioning or subpoena (it is in their \`truth\`, and the clues only hint at it). Several plausible motives and trails must stay open without it.
- 4 motive options and 4 trail options. They must be equally specific and equally plausible: same length and level of detail, each naming concrete people, wallets or places from the case. The right answer must never be the only detailed or the only "interesting" option.
- Not guessable from the start: from the briefing, timeline, suspect cards, openers and explorer alone (no clues, no chats), at least three suspects must look equally likely. Don't make the briefing or a blurb point at the culprit, don't give the culprit the only suspicious cover story, and don't label wallets in a way that names the owner of the money trail.
- 3 hints, each pointing at a step of the reasoning without giving the answer.
- \`reveal\`: 4 to 6 short lines explaining what really happened and clearing the red herrings.
- Every fact is consistent: names, handles, times, amounts and wallet ids match across briefing, timeline, clues, truths, explorer and reveal.
- Plain, punchy English. Short sentences. Suspect openers sound like real DMs.

## Content rules (strict)
- Everything is fictional parody: invented projects, people, handles, exchanges and wallet addresses. Never use a real person, company, exchange, project, token or real-looking wallet address. Addresses look fake (e.g. "EQ...7fA2" style placeholders with obvious shortening).
- The case shows how a scam is caught, never how to run one: no step-by-step instructions, no working code, no real techniques beyond the level of a news story.
- No slurs, no sexual content, nothing cruel about real groups. Light, funny, a bit cynical.

## The file format
Reply with one case as a single JSON object (a \`CaseFile\` without the fields below) and nothing else. These TypeScript types (with comments) describe every field:

\`\`\`ts
${types}
\`\`\`

The pipeline sets \`district\`, \`preview\` and \`targetSec\` itself; leave them out.

## How your case is tested
A blind solver plays it several ways. It must fail with only the public information (the answer can't be guessed from the briefing and options), fail to name the culprit confidently from any one player's clues, still miss something with all clues but no chats, and get everything right with all clues plus the suspects' confessions.

The three examples below have a known flaw: the right motive and trail options are more specific than the wrong ones, and the briefing points at the culprit, so a solver guesses them with no clues at all. Copy their tone, size and structure, not that.

## Three finished cases, as examples of tone, size and structure
${examples.map((c) => `\`\`\`json\n${JSON.stringify(strip(c))}\n\`\`\``).join('\n\n')}`
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]
}

export interface DraftRequest {
  district: District
  crime: string
  /** Titles and projects already used, to avoid repeats. */
  avoid: string[]
}

export type DraftResult = { ok: true; caseFile: CaseFile; attempts: number } | { ok: false; errors: string[]; attempts: number }

/**
 * Drafts one case, or revises `revise.previous` given the solver's feedback. Retries with the
 * schema and static-check errors up to DRAFT_RETRIES times.
 */
export async function draftCase(req: DraftRequest, examples: CaseFile[], revise?: { previous: CaseFile; feedback: string[] }): Promise<DraftResult> {
  const system = draftSystem(examples)
  const brief = `Write a new case for the district ${req.district.name} (crimes here: ${req.district.crimes}; the skill this district tests: ${req.district.skill}).

Crime for this case: ${req.crime}.

Don't reuse any of these titles or projects: ${req.avoid.join('; ') || 'none yet'}.

Give it a short kebab-case \`id\` based on its title.`

  let previous: string | null = revise ? JSON.stringify(revise.previous) : null
  let errors: string[] = revise?.feedback ?? []
  for (let attempt = 1; attempt <= DRAFT_RETRIES + 1; attempt++) {
    const user = previous
      ? `${brief}\n\nYour previous draft failed these checks:\n${errors.map((e) => `- ${e}`).join('\n')}\n\nHere it is. Fix every problem and return the whole corrected case.\n\n${previous}`
      : brief
    let raw: unknown
    try {
      raw = await structured({ model: CASE_MODEL, system, user, effort: 'high', maxTokens: 64_000 })
    } catch (err) {
      errors = [`The call failed: ${(err as Error).message}`]
      continue
    }
    const candidate = { ...(raw as object), district: req.district.id, targetSec: 1 }
    const parsed = caseSchema.safeParse(candidate)
    if (!parsed.success) {
      errors = parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`)
    } else {
      const caseFile = { ...parsed.data, targetSec: suggestTargetSec(parsed.data) }
      errors = staticProblems(caseFile)
      if (!errors.length) return { ok: true, caseFile, attempts: attempt }
    }
    previous = JSON.stringify(raw)
  }
  return { ok: false, errors, attempts: DRAFT_RETRIES + 1 }
}

// ── Blind solver ───────────────────────────────────────────────────────────

const solverAnswer = z.object({
  reasoning: z.string(),
  culprit: z.string(),
  motive: z.string(),
  trail: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
})

const SOLVER_SYSTEM: Anthropic.Beta.BetaTextBlockParam[] = [
  {
    type: 'text',
    text: `You are a sharp detective playing "Who Rugged?", a fictional crypto-crime puzzle game. You get a case file, a blockchain explorer, and some of the evidence. Work out who did it (culprit), why (motive) and where the money went (trail), choosing ids from the options given.

Rules:
- Use only the evidence in front of you. Don't assume facts you weren't shown.
- If the evidence doesn't settle a question, still give your best guess, and say so with low confidence.
- confidence is about the culprit: "high" only if the evidence you have proves it, "medium" if it points there but leaves a reasonable alternative, "low" if it's a guess.
- Keep reasoning to 2 to 4 sentences.`,
  },
]

/**
 * The case as any player sees it: no clues, no truths. The explorer is fully traced (players
 * can buy Traces) unless `untraced`, which hides funding the way it looks before any Trace.
 */
function publicFile(c: CaseFile, untraced = false) {
  return {
    title: c.title,
    crime: c.crime,
    tagline: c.tagline,
    project: c.project,
    briefing: c.briefing,
    timeline: c.timeline,
    suspects: c.suspects.map((s) => ({ id: s.id, name: s.name, handle: s.handle, role: s.blurb, saysPublicly: s.cover, firstMessage: s.opener })),
    explorer: {
      wallets: c.wallets.map((w) => ({ id: w.id, address: w.address, label: w.label, fundedBy: untraced && w.fundingHidden ? 'not traced yet' : w.fundedBy, note: w.note })),
      transactions: c.txs,
    },
    motiveOptions: c.motives,
    trailOptions: c.trails,
  }
}

async function solveOnce(
  c: CaseFile,
  label: string,
  evidence: { clueIds: string[]; interrogation: boolean; untraced?: boolean },
): Promise<Omit<SolverRun, 'pass'>> {
  const clues = c.clues.filter((cl) => evidence.clueIds.includes(cl.id))
  const user = `CASE FILE AND EXPLORER\n${JSON.stringify(publicFile(c, evidence.untraced))}

YOUR CLUES (${clues.length} of ${c.clues.length})\n${JSON.stringify(clues)}
${
  evidence.interrogation
    ? `\nWHAT EACH SUSPECT ADMITTED UNDER QUESTIONING\n${JSON.stringify(c.suspects.map((s) => ({ suspect: s.id, admitted: s.truth })))}`
    : '\nYou have not questioned any suspect.'
}

Answer with ids from the options.`
  const a = solverAnswer.parse(await structured({ model: SOLVER_MODEL, system: SOLVER_SYSTEM, user, schema: solverAnswer, effort: 'high', maxTokens: 16_000 }))
  return {
    label,
    ...a,
    correct: { culprit: a.culprit === c.answer.culprit, motive: a.motive === c.answer.motive, trail: a.trail === c.answer.trail },
  }
}

const allRight = (r: Pick<SolverRun, 'correct'>) => r.correct.culprit && r.correct.motive && r.correct.trail

/** Unique single-seat hands across 3 to 6 seats, labelled by where they first appear. */
function singleHands(c: CaseFile) {
  const seen = new Map<string, { label: string; clueIds: string[] }>()
  for (const n of SEAT_COUNTS)
    dealClues(c, n).forEach((hand, seat) => {
      const key = [...hand].sort().join()
      if (!seen.has(key)) seen.set(key, { label: `${n} seats, hand ${seat + 1}`, clueIds: hand })
    })
  return [...seen.values()]
}

/** What to tell the drafter about a failed solver review, with the solver's own reasoning. */
export function solverFeedback(c: CaseFile, review: CaseReview): string[] {
  const out: string[] = review.staticProblems.map((p) => `Static check: ${p}`)
  const first = (runs: SolverRun[] | undefined) => runs?.find((r) => !r.pass)
  const pub = first(review.publicOnly)
  if (pub)
    out.push(
      `With ONLY the briefing, timeline, suspect cards, openers, untraced explorer and options (no clues), the solver guessed ${pub.culprit} / ${pub.motive} / ${pub.trail} (${pub.confidence} confidence). Its reasoning: "${pub.reasoning}". Remove what points there and make the options equally specific.`,
    )
  const noChat = first(review.noChats)
  if (noChat)
    out.push(
      `With all clues but no suspect chats, the solver got all three right. Its reasoning: "${noChat.reasoning}". Move the decisive fact for the motive or the trail out of the clues and into a suspect's truth, leaving clues that only hint at it, so players must interrogate.`,
    )
  if (review.noChats.every((r) => r.pass) && !review.needsInterrogation.length)
    out.push('Without chats the solver missed different questions on different runs. Make one question (motive or trail) clearly impossible to settle from the clues alone.')
  const seen = new Set<string>()
  for (const r of review.hands.filter((h) => !h.pass)) {
    const hand = r.label.replace(/ · run \d+$/, '')
    if (seen.has(hand)) continue
    seen.add(hand)
    const [n, seat] = hand.match(/\d+/g)!.map(Number)
    const ids = dealClues(c, n)[seat - 1]
    out.push(
      `One player holding only clues ${ids.join(', ')} (${hand}) named the culprit with high confidence. Its reasoning: "${r.reasoning}". Split that evidence so it takes clues from two different players.`,
    )
  }
  const full = first(review.full)
  if (full)
    out.push(
      `With every clue AND every suspect's confession, the solver still answered ${full.culprit} / ${full.motive} / ${full.trail}, which is wrong. Its reasoning: "${full.reasoning}". Make sure the truths and clues together settle the right answer.`,
    )
  return out
}

/** Static checks plus the blind solver; the report the case is stored with. */
export async function checkCase(c: CaseFile, meta: { draftModel?: string; crime?: string } = {}): Promise<CaseReview> {
  const problems = staticProblems(c)
  const allClues = c.clues.map((cl) => cl.id)
  const runs = (label: string) => Array.from({ length: SOLVER_RUNS }, (_, i) => `${label} · run ${i + 1}`)

  const jobs = [
    ...runs('public info only').map((label) => ({ kind: 'publicOnly' as const, label, clueIds: [] as string[], interrogation: false, untraced: true })),
    ...runs('all clues + interrogation').map((label) => ({ kind: 'full' as const, label, clueIds: allClues, interrogation: true })),
    ...runs('all clues, no chats').map((label) => ({ kind: 'noChats' as const, label, clueIds: allClues, interrogation: false })),
    ...singleHands(c).flatMap((h) => runs(h.label).map((label) => ({ kind: 'hands' as const, label, clueIds: h.clueIds, interrogation: false }))),
  ]
  const results = await inBatches(jobs, SOLVER_PARALLEL, async (j) => {
    const r = await solveOnce(c, j.label, j)
    const pass =
      j.kind === 'full'
        ? allRight(r)
        : j.kind === 'noChats'
          ? !allRight(r)
          : j.kind === 'publicOnly'
            ? !allRight(r) && !(r.correct.culprit && r.confidence !== 'low')
            : !(r.correct.culprit && r.confidence === 'high')
    return { kind: j.kind, run: { ...r, pass } }
  })
  const of = (kind: (typeof jobs)[number]['kind']) => results.filter((r) => r.kind === kind).map((r) => r.run)
  const publicOnly = of('publicOnly')
  const full = of('full')
  const noChats = of('noChats')
  const hands = of('hands')

  // A question needs interrogation if the solver without chats missed it every time.
  const needsInterrogation = (['culprit', 'motive', 'trail'] as Question[]).filter((q) => noChats.every((r) => !r.correct[q]))
  const failures = [
    ...problems.map((p) => `Static: ${p}`),
    ...publicOnly.filter((r) => !r.pass).map((r) => `Guessable from public info alone (${r.label})`),
    ...full.filter((r) => !r.pass).map((r) => `With everything, the solver got it wrong (${r.label})`),
    ...noChats.filter((r) => !r.pass).map((r) => `Solvable without interrogation (${r.label})`),
    ...hands.filter((r) => !r.pass).map((r) => `One hand names the culprit with high confidence (${r.label})`),
    ...(noChats.every((r) => r.pass) && !needsInterrogation.length ? ['Without chats the solver missed different questions each run; none clearly needs interrogation'] : []),
  ]
  return {
    checkedAt: Date.now(),
    draftModel: meta.draftModel,
    solverModel: SOLVER_MODEL,
    crime: meta.crime,
    staticProblems: problems,
    publicOnly,
    full,
    noChats,
    hands,
    needsInterrogation,
    suggestedTargetSec: suggestTargetSec(c),
    passed: failures.length === 0,
    failures,
  }
}
