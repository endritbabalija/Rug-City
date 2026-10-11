// Case data is server-only: it holds the hidden truth and every player's
// private clues. Clients only ever receive the projection from lib/game/view.ts.

export type Archetype = 'anon-dev' | 'influencer' | 'co-founder' | 'community-mod' | 'audit-firm' | 'whale'

export type Question = 'culprit' | 'motive' | 'trail'

export interface ChatLine {
  from: string
  at: string
  text: string
  deleted?: boolean
}

export type ClueBody =
  | { kind: 'chat'; channel: string; lines: ChatLine[] }
  | { kind: 'post'; author: string; handle: string; at: string; text: string; deleted?: boolean; editedFrom?: string; stats?: string }
  | { kind: 'code'; repo: string; commit: string; author: string; at: string; message: string; diff: string[] }
  | { kind: 'multisig'; wallet: string; proposal: string; at: string; votes: { signer: string; vote: 'yes' | 'no' | 'absent' }[]; note?: string }
  | { kind: 'doc'; heading: string; lines: string[]; footer?: string }

export interface Clue {
  id: string
  title: string
  /** Where the clue "came from", shown as a stamp on the card. */
  source: string
  body: ClueBody
}

export interface Wallet {
  id: string
  address: string
  label: string
  /** Who first funded this wallet. */
  fundedBy: string
  /** When true, fundedBy is masked until someone uses Trace on it. */
  fundingHidden?: boolean
  note?: string
}

export interface Tx {
  id: string
  at: string
  from: string
  to: string
  amount: string
  token: string
  memo?: string
}

export interface Suspect {
  id: string
  name: string
  handle: string
  archetype: Archetype
  avatar: string
  /** One-line public description shown on the suspect card. */
  blurb: string
  cover: string
  /** First private message this suspect sends to the players assigned to them. */
  opener: string
  /** Character voice and attitude for the live chat model. */
  persona: string
  /** What this suspect actually did. Never shown to players before the reveal. */
  truth: string
  /** Lies they tell to protect themselves. */
  lies: string[]
  /** Scripted replies, used when no AI key is configured or the model call fails. */
  fallback: string[]
  /** Truthful answer used by Subpoena when the model is unavailable. */
  subpoenaFallback: string
}

export interface Option {
  id: string
  text: string
}

export interface CaseFile {
  id: string
  title: string
  crime: string
  tagline: string
  project: { name: string; ticker: string; pitch: string }
  briefing: string[]
  timeline: { at: string; text: string }[]
  suspects: Suspect[]
  clues: Clue[]
  /**
   * Order in which clues are dealt round-robin to seats. Clues that only prove
   * something together sit next to each other so they always land on different players.
   */
  dealOrder: string[]
  /**
   * Sets of clues that, together with the shared explorer, are enough to name
   * the culprit. The solvability test checks that no single player ever holds one.
   */
  culpritProofs: string[][]
  wallets: Wallet[]
  txs: Tx[]
  motives: Option[]
  trails: Option[]
  answer: { culprit: string; motive: string; trail: string }
  hints: string[]
  reveal: string[]
  /** Target solve time in seconds, until the case has enough plays for a median (`targetFor`). */
  targetSec: number
}
