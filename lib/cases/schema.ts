import { z } from 'zod'
import { DISTRICT_IDS } from '../districts'
import type { CaseFile } from './types'

// The shape of a case file, checked whenever a case loads from the `cases` table.
// Typed against `CaseFile`, so the two can't drift apart. Consistency between the
// parts (answers, proofs, deal order) is checked by tests/cases.test.ts.

const text = z.string().min(1)

const chatLine = z.object({ from: text, at: z.string(), text: text, deleted: z.boolean().optional() })

const clueBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat'), channel: text, lines: z.array(chatLine).min(1) }),
  z.object({
    kind: z.literal('post'),
    author: text,
    handle: text,
    at: z.string(),
    text: text,
    deleted: z.boolean().optional(),
    editedFrom: z.string().optional(),
    stats: z.string().optional(),
  }),
  z.object({ kind: z.literal('code'), repo: text, commit: text, author: text, at: z.string(), message: text, diff: z.array(z.string()) }),
  z.object({
    kind: z.literal('multisig'),
    wallet: text,
    proposal: text,
    at: z.string(),
    votes: z.array(z.object({ signer: text, vote: z.enum(['yes', 'no', 'absent']) })),
    note: z.string().optional(),
  }),
  z.object({ kind: z.literal('doc'), heading: text, lines: z.array(z.string()), footer: z.string().optional() }),
])

const suspect = z.object({
  id: text,
  name: text,
  handle: text,
  archetype: z.enum(['anon-dev', 'influencer', 'co-founder', 'community-mod', 'audit-firm', 'whale']),
  avatar: text,
  blurb: text,
  cover: text,
  opener: text,
  persona: text,
  truth: text,
  lies: z.array(text),
  fallback: z.array(text).min(1),
  subpoenaFallback: text,
})

const option = z.object({ id: text, text: text })

export const caseSchema: z.ZodType<CaseFile> = z.object({
  id: text,
  title: text,
  crime: text,
  tagline: text,
  project: z.object({ name: text, ticker: text, pitch: text }),
  briefing: z.array(text).min(1),
  timeline: z.array(z.object({ at: text, text: text })),
  suspects: z.array(suspect).min(1),
  clues: z.array(z.object({ id: text, title: text, source: text, body: clueBody })).min(1),
  dealOrder: z.array(text),
  culpritProofs: z.array(z.array(text).min(1)),
  wallets: z.array(
    z.object({ id: text, address: text, label: text, fundedBy: text, fundingHidden: z.boolean().optional(), note: z.string().optional() }),
  ),
  txs: z.array(z.object({ id: text, at: text, from: text, to: text, amount: text, token: text, memo: z.string().optional() })),
  motives: z.array(option).min(2),
  trails: z.array(option).min(2),
  answer: z.object({ culprit: text, motive: text, trail: text }),
  hints: z.array(text),
  reveal: z.array(text).min(1),
  targetSec: z.number().int().positive(),
  district: z.enum(DISTRICT_IDS),
  preview: z.boolean().optional(),
})
