// Shapes shared by case definitions, the pure rules and the projection.
// A case definition is authored, versioned and server-only (`cases/*`). A run is one
// player's progress through one case, pinned to the version it started on, and holds
// only ids of what was unlocked; text is always read back from the definition.

export type RunStatus = 'intro' | 'investigating' | 'resolved'

/** Everything listed must already hold. An empty requirement always holds. */
export interface Requirement {
  evidence?: string[]
  findings?: string[]
  confrontations?: string[]
  topics?: string[]
}

/** How a record came to the agency. Statements (testimony) and findings (inference) are not records. */
export type EvidenceKind = 'public' | 'supplied' | 'service' | 'voluntary'

export interface EvidenceDef {
  id: string
  title: string
  source: string
  kind: EvidenceKind
  /** Shown as written, e.g. "10:00" or "Day −1, 16:00". */
  time: string
  /** Minutes from Case Day 00:00, for the timeline aid. Day −1 is negative. */
  minute: number
  sections: { heading?: string; lines: string[] }[]
  /** A plain-language explanation of a concept the record relies on. Adds no facts. */
  explainer?: string
}

/** A link inside a record that opens another record (e.g. a ledger reference). */
export interface LeadDef {
  id: string
  evidence: string
  label: string
  unlocks: string[]
}

export interface PersonDef {
  id: string
  name: string
  role: string
  kind: 'suspect' | 'contact'
  initials: string
  available: Requirement
  /** Lines shown at the top of the conversation once the person is available. */
  opening: string[]
}

export interface LineDef {
  speaker: string
  text: string
}

export interface StatementDef {
  id: string
  person: string
  text: string
  visible: Requirement
  /** The confrontation that changes or contradicts this statement. */
  changedBy?: string
}

export interface TopicDef {
  id: string
  person: string
  label: string
  requires: Requirement
  lines: string[]
  unlocks?: string[]
}

/** Feedback chosen when every listed record is among those submitted. First match wins. */
export interface FeedbackRule {
  when: string[]
  text: string
}

/** A claim the player can test by attaching records. Either a real finding or a plausible wrong inference. */
export interface ClaimDef {
  id: string
  text: string
  visible: Requirement
  /** Set for a real finding; the claim id is then the finding id. */
  support?: string[][]
  feedback: FeedbackRule[]
  fallback: string
}

export interface ChallengeDef {
  id: string
  statement: string
  text: string
  visible: Requirement
  /** Set when this challenge is the confrontation; its id is the confrontation id. */
  confrontation?: {
    evidence?: string[]
    findings?: string[]
    lines: string[]
    unlocks?: string[]
    insufficient: string
  }
  /** For a wrong challenge. */
  feedback?: string
}

export interface HintStepDef {
  id: string
  title: string
  available: Requirement
  done: Requirement
  levels: [string, string, string]
}

/** A line that applies when `requires` holds and `unless` (if set) does not. */
export interface ContextLine {
  requires: Requirement
  unless?: Requirement
  text: string
}

export interface AccusationDef {
  suspects: string[]
  culprit: string
  slots: { id: string; label: string; findings: string[]; missing: string; attach: string }[]
  available: Requirement
  insufficient: string
  /** Objections to a wrong suspect: the last entry that applies. */
  objections: Record<string, ContextLine[]>
}

export interface EndingDef {
  title: string
  /** Paragraphs, each shown when its requirement holds. */
  reconstruction: ContextLine[]
  closing: LineDef[]
  teaser: string
}

/** Optional ordering aid. A correct order submits `claim` with `submit` through the normal finding check. */
export interface TimelineDef {
  requires: Requirement
  items: { evidence: string; label: string }[]
  claim: string
  submit: string[]
}

export interface CaseDefinition {
  id: string
  version: number
  title: string
  intro: { from: string; message: string; headline: string }
  evidence: EvidenceDef[]
  initialEvidence: string[]
  leads: LeadDef[]
  people: PersonDef[]
  lines: Record<string, LineDef>
  statements: StatementDef[]
  topics: TopicDef[]
  claims: ClaimDef[]
  challenges: ChallengeDef[]
  hints: HintStepDef[]
  timeline?: TimelineDef
  /** Case desk question and Dex's line: the last entry whose requirement holds. */
  questions: ContextLine[]
  dex: ContextLine[]
  accusation: AccusationDef
  ending: EndingDef
}

export interface RunProgress {
  evidence: string[]
  findings: { id: string; support: string[] }[]
  confrontations: string[]
  topics: string[]
  leads: string[]
  /** Scripted conversation events, keyed by topic or confrontation id. */
  transcript: { key: string; at: number }[]
  hints: Record<string, number>
  accusation: { suspect: string; findings: string[] } | null
}

export interface Run {
  id: string
  ownerId: number
  caseId: string
  caseVersion: number
  status: RunStatus
  progress: RunProgress
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
}

export type Action =
  | { type: 'open_case' }
  | { type: 'open_topic'; topic: string }
  | { type: 'follow_lead'; lead: string }
  | { type: 'submit_finding'; claim: string; evidence: string[] }
  | { type: 'confront'; challenge: string; evidence: string[]; findings: string[] }
  | { type: 'request_hint'; step: string }
  | { type: 'accuse'; suspect: string; slots: Record<string, string[]>; activeMs?: number }
  | { type: 'evidence_opened'; evidence: string }
