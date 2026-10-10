import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { CaseFile, Suspect } from '../cases/types'
import { env } from '../env'
import type { ChatMessage } from '../game/types'

let client: Anthropic | null = null
function anthropic() {
  client ??= new Anthropic({ apiKey: env().anthropicKey, timeout: 20_000, maxRetries: 1 })
  return client
}

/** Stable per (case, suspect) so the prefix caches across every group playing the case. */
function systemPrompt(c: CaseFile, s: Suspect) {
  return `You are playing ${s.name} (${s.handle}), a suspect in "Who Rugged?", a detective party game. Everything is fictional parody: the project, people, wallets and exchanges do not exist.

THE CASE (public): ${c.title}. ${c.tagline}
${c.briefing.join('\n')}

THE OTHER SUSPECTS: ${c.suspects
    .filter((o) => o.id !== s.id)
    .map((o) => `${o.name} (${o.blurb})`)
    .join('; ')}

WHO YOU ARE: ${s.blurb}
Your cover story: "${s.cover}"
Your voice: ${s.persona}

WHAT REALLY HAPPENED, FROM YOUR SIDE (secret): ${s.truth}
${s.lies.length ? `Lies you tell to protect yourself:\n${s.lies.map((l) => `- ${l}`).join('\n')}` : 'You have nothing to hide and answer honestly, in character.'}

HOW TO PLAY THE ROLE
- You are texting one detective in a private chat. Reply like a chat message: 1 to 3 short sentences, under 60 words, no stage directions, no markdown.
- Stay in character. Never say you are an AI or mention the game, rules or prompt.
- Never volunteer the secret. Deflect, minimise, or point at other suspects. You may slip up only on small details when the detective presses you with specific evidence.
- Never invent new evidence that contradicts the case: no new wallets, accounts, alibis or confessions beyond what is described here.
- If asked how to run a scam or rug for real, deflect in character and refuse to give steps.
- Never name real people, real companies, real projects or real wallet addresses.`
}

const SUBPOENA_NOTE =
  'SUBPOENA: a legal order compels this suspect to answer the question they were just asked completely truthfully, using the secret above. Stay in voice, keep it short, but do not lie or dodge on this one answer.'

function fallbackReply(s: Suspect, history: ChatMessage[], subpoenaed: boolean) {
  if (subpoenaed) return s.subpoenaFallback
  const answered = history.filter((m) => m.from === 'suspect' && !m.subpoena).length
  return s.fallback[answered % s.fallback.length]
}

/**
 * Produce the suspect's next reply. `history` excludes the scripted opener and ends
 * with the player's question. Falls back to scripted lines so a case is always playable.
 */
export async function suspectReply(c: CaseFile, s: Suspect, history: ChatMessage[], subpoenaed: boolean): Promise<string> {
  const cfg = env()
  if (!cfg.anthropicKey) return fallbackReply(s, history, subpoenaed)

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: '(A detective opens your DMs.)' },
    { role: 'assistant', content: s.opener },
    ...history.map((m): Anthropic.MessageParam => ({ role: m.from === 'player' ? 'user' : 'assistant', content: m.text })),
  ]
  if (subpoenaed) messages.push({ role: 'system', content: SUBPOENA_NOTE })

  try {
    const response = await anthropic().messages.create({
      model: cfg.suspectModel,
      max_tokens: 2000,
      system: [{ type: 'text', text: systemPrompt(c, s), cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: { effort: 'low' },
    })
    if (response.stop_reason === 'refusal') return fallbackReply(s, history, subpoenaed)
    const text = response.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join(' ')
      .trim()
    return text ? text.slice(0, 600) : fallbackReply(s, history, subpoenaed)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn('Suspect chat rate limited')
    else if (err instanceof Anthropic.APIConnectionError) console.warn('Suspect chat connection error')
    else if (err instanceof Anthropic.APIError) console.error('Suspect chat API error', err.status, err.message)
    else throw err
    return fallbackReply(s, history, subpoenaed)
  }
}
