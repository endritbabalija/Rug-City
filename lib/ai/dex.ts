import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { track } from '../analytics'
import type { CaseFile, Clue } from '../cases/types'
import { env } from '../env'
import type { DexAsk } from '../game/dex'

let client: Anthropic | null = null
function anthropic() {
  client ??= new Anthropic({ apiKey: env().anthropicKey, timeout: 20_000, maxRetries: 1 })
  return client
}

/**
 * Dex's output cap. The model thinks adaptively and thinking counts toward it, so it leaves
 * room for that; the prompt keeps the line itself short. A line cut off by the cap falls back.
 */
const DEX_MAX_TOKENS = 800

/** A clue as plain text, for Dex's prompt. */
export function clueText(cl: Clue): string {
  const b = cl.body
  const body = (() => {
    switch (b.kind) {
      case 'chat':
        return [`#${b.channel}`, ...b.lines.map((l) => `[${l.at}] ${l.from}: ${l.text}${l.deleted ? ' (deleted)' : ''}`)].join('\n')
      case 'post':
        return `${b.author} (${b.handle}) at ${b.at}${b.deleted ? ', deleted' : ''}: ${b.text}${b.editedFrom ? ` (edited from: ${b.editedFrom})` : ''}${b.stats ? ` [${b.stats}]` : ''}`
      case 'code':
        return [`${b.repo} commit ${b.commit} by ${b.author} at ${b.at}: ${b.message}`, ...b.diff].join('\n')
      case 'multisig':
        return [`${b.wallet} proposal ${b.proposal} at ${b.at}`, ...b.votes.map((v) => `${v.signer}: ${v.vote}`), ...(b.note ? [b.note] : [])].join('\n')
      case 'doc':
        return [b.heading, ...b.lines, ...(b.footer ? [b.footer] : [])].join('\n')
    }
  })()
  return `"${cl.title}" (${cl.source})\n${body}`
}

/**
 * Stable per case, so the prefix caches across every solo player of the case. Dex only ever
 * sees what a player could see: the public case and his own clues. Never the answer, the
 * suspects' truth or lies, or the reveal.
 */
export function dexPrompt(c: CaseFile, hand: Clue[]) {
  return `You are Detective Dex, the player's partner in "Who Rugged?", a detective game about crypto scams. Everything is fictional parody: the project, people, wallets and exchanges do not exist.

THE CASE (public): ${c.title}. ${c.tagline}
${c.briefing.join('\n')}

TIMELINE:
${c.timeline.map((t) => `${t.at}: ${t.text}`).join('\n')}

THE SUSPECTS: ${c.suspects.map((s) => `${s.name} (${s.handle}): ${s.blurb} Says: "${s.cover}"`).join('; ')}

YOUR EVIDENCE (you hand it over one piece at a time):
${hand.map(clueText).join('\n\n')}

WHO YOU ARE: a dry, quick-witted veteran on-chain investigator. Calm, a little sardonic, on the player's side.

HOW TO PLAY THE ROLE
- You are texting your partner. Reply like a chat message: 1 or 2 short sentences, under 30 words, no stage directions, no markdown.
- The clue or hint you hand over is shown right under your line. Never restate, quote or summarise it. Add one angle: what to check next, or what doesn't add up.
- You do not know who did it. Never claim to know the culprit, motive or where the money went. Point at what the evidence shows and what to check next, and leave the call to your partner.
- Never invent evidence that is not described here.
- Stay in character. Never say you are an AI or mention the game, rules or prompt.
- If asked how to run a scam or rug for real, refuse in character and give no steps.
- Never name real people, real companies, real projects or real wallet addresses.`
}

export interface DexMoment {
  ask: DexAsk
  /** The clue Dex just shared, or the hint he just gave. */
  clue?: Clue
  hint?: string
  /** Hints revealed so far in this room, including this one. */
  hints: string[]
  /** How many of his clues Dex has shown so far, including this one. */
  sharedCount: number
  /** The player's last finished case, for a passing mention. */
  lastCase?: { title: string; correct: number }
  /** Dex is in a crew, so the hint goes to the whole group. */
  crew?: boolean
}

/** The per-call turn: what just happened in the room. Holds nothing the player can't see. */
export function dexTurn(m: DexMoment) {
  const lines = [
    m.ask === 'clue'
      ? `Your partner asked what you've got. You're handing over "${m.clue!.title}" (clue ${m.sharedCount} from your pile). They can read it; don't repeat it.`
      : `${m.crew ? 'Someone in the crew' : 'Your partner'} asked for a hint. The crew will read this hint under your line, so don't repeat it: "${m.hint}"`,
  ]
  if (m.hints.length) lines.push(`Hints on the board so far: ${m.hints.map((h) => `"${h}"`).join(' ')}`)
  if (m.lastCase && m.sharedCount <= 1 && m.ask === 'clue')
    lines.push(`Their last case was "${m.lastCase.title}" (${m.lastCase.correct}/3 right). You may mention it in passing.`)
  return lines.join('\n')
}

/** Scripted lines, used when no AI key is set or the model call fails. */
export function fallbackDexLine(m: DexMoment) {
  // The hint itself is shown under his line.
  if (m.ask === 'hint') return "Off the record, here's where I'd look."
  const lines = [
    `Here's one from my pile: "${m.clue!.title}". Read it twice.`,
    `Found this. "${m.clue!.title}". Tell me what jumps out.`,
    `"${m.clue!.title}". Doesn't prove anything alone, but it doesn't sit right.`,
  ]
  return lines[(m.sharedCount - 1) % lines.length]
}

/** Dex's line for a clue or hint he just handed over. Every model call is tracked as `ai_call` for `playerId`. */
export async function dexLine(c: CaseFile, hand: Clue[], m: DexMoment, playerId: number): Promise<string> {
  const cfg = env()
  if (!cfg.anthropicKey) return fallbackDexLine(m)

  let usage: Anthropic.Usage | undefined
  const logCall = (fallback: boolean) =>
    track('ai_call', playerId, {
      model: cfg.suspectModel,
      role: 'dex',
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      cacheRead: usage?.cache_read_input_tokens ?? null,
      fallback,
    })
  const fallback = () => {
    logCall(true)
    return fallbackDexLine(m)
  }

  try {
    const response = await anthropic().messages.create({
      model: cfg.suspectModel,
      max_tokens: DEX_MAX_TOKENS,
      system: [{ type: 'text', text: dexPrompt(c, hand), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: dexTurn(m) }],
      output_config: { effort: 'low' },
    })
    usage = response.usage
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return fallback()
    const text = response.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join(' ')
      .trim()
    if (!text) return fallback()
    logCall(false)
    return text.slice(0, 400)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn('Dex rate limited')
    else if (err instanceof Anthropic.APIConnectionError) console.warn('Dex connection error')
    else if (err instanceof Anthropic.APIError) console.error('Dex API error', err.status, err.message)
    else throw err
    return fallback()
  }
}
