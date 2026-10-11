import { describe, expect, it } from 'vitest'
import { clueText, dexPrompt, dexTurn, fallbackDexLine } from '@/lib/ai/dex'
import { BUILT_IN_CASES as CASES } from '@/lib/cases'
import { mooncat } from '@/lib/cases/mooncat'
import * as engine from '@/lib/game/engine'
import { GameError } from '@/lib/game/engine'
import { DEX_FREE_HINTS, dexHand, dexHint, dexHintsLeft, shareNextClue } from '@/lib/game/dex'
import { HELP_PENALTY, helpPenalty } from '@/lib/game/scoring'
import { DEX_ID, type RoomState } from '@/lib/game/types'
import { buildView } from '@/lib/game/view'
import { pollMs, POLL_FALLBACK_MS, POLL_LIVE_MS } from '@/lib/client/sync'

const T0 = 1_000_000
const me = { id: 7, name: 'Ana' }

function solo(c = mooncat): RoomState {
  const s = engine.createSoloRoom('SOLO1', c, me, T0)
  return engine.ready(s, me.id, T0 + 1000)
}

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as GameError).code
  }
  return null
}

describe('solo room', () => {
  it('seats the player and Dex and opens on the briefing', () => {
    const s = engine.createSoloRoom('SOLO1', mooncat, me, T0)
    expect(s.mode).toBe('solo')
    expect(s.phase).toBe('briefing')
    expect(s.seats).toEqual([me.id, DEX_ID])
    expect(s.players.map((p) => p.id)).toEqual([me.id])
    // Reading the briefing alone starts the investigation.
    expect(solo().phase).toBe('investigate')
  })

  it('ends on the player vote alone, since Dex never votes', () => {
    let s = engine.callVote(solo(), me.id, T0 + 60_000)
    s = engine.castVote(s, mooncat, me.id, mooncat.answer, T0 + 120_000)
    expect(s.phase).toBe('reveal')
    expect(s.result!.correct).toEqual({ culprit: true, motive: true, trail: true })
  })
})

describe.each(CASES.map((c) => [c.title, c] as const))('Dex on %s', (_title, c) => {
  it("covers every clue between the player's hand and Dex's", () => {
    const s = solo(c)
    const all = [...engine.cluesFor(s, c, me.id), ...dexHand(s, c)]
    expect(all.sort()).toEqual(c.clues.map((cl) => cl.id).sort())
  })

  it('never sees the answer, the truth, the lies or the reveal', () => {
    const s = solo(c)
    const hand = dexHand(s, c).map((id) => c.clues.find((cl) => cl.id === id)!)
    const turns = [
      dexTurn({ ask: 'clue', clue: hand[0], hints: [], sharedCount: 1, lastCase: { title: 'Another case', correct: 2 } }),
      dexTurn({ ask: 'hint', hint: c.hints[0], hints: c.hints, sharedCount: 1 }),
    ]
    const prompt = [dexPrompt(c, hand), ...turns].join('\n')
    const secrets = [
      ...c.suspects.flatMap((sus) => [sus.truth, ...sus.lies, sus.subpoenaFallback, sus.persona]),
      ...c.reveal,
      c.motives.find((m) => m.id === c.answer.motive)!.text,
      c.trails.find((t) => t.id === c.answer.trail)!.text,
    ]
    for (const secret of secrets) expect(prompt, secret).not.toContain(secret)
    // He does get his own evidence.
    for (const cl of hand) expect(prompt).toContain(clueText(cl))
  })

  it('shares each of his clues once, then runs out', () => {
    let s = solo(c)
    const hand = dexHand(s, c)
    for (const id of hand) {
      const r = shareNextClue(s, c, me.id, T0 + 2000)
      expect(r.clueId).toBe(id)
      s = r.state
    }
    expect(s.dexShared).toEqual(hand)
    expect(code(() => shareNextClue(s, c, me.id, T0 + 3000))).toBe('DEX_OUT_OF_CLUES')
  })
})

describe('Dex hints', () => {
  it(`stop at ${DEX_FREE_HINTS} and each carries the Dex hint penalty`, () => {
    let s = solo()
    for (let i = 0; i < DEX_FREE_HINTS; i++) {
      const r = dexHint(s, mooncat, me.id, T0 + 2000)
      expect(r.hint).toBe(mooncat.hints[i])
      s = r.state
    }
    expect(s.hintsRevealed).toBe(DEX_FREE_HINTS)
    expect(engine.roomHelp(s).dexHint).toBe(DEX_FREE_HINTS)
    expect(helpPenalty(engine.roomHelp(s))).toBeCloseTo(DEX_FREE_HINTS * HELP_PENALTY.dexHint)
    expect(dexHintsLeft(s, mooncat)).toBe(0)
    expect(code(() => dexHint(s, mooncat, me.id, T0 + 3000))).toBe('DEX_OUT_OF_HINTS')

    // A shop Hint still works afterwards.
    s = engine.revealHint(s, mooncat, me.id, T0 + 4000)
    expect(s.hintsRevealed).toBe(DEX_FREE_HINTS + 1)
  })

  it('counts hints already on the board', () => {
    let s = solo()
    for (let i = 0; i < mooncat.hints.length - 1; i++) s = engine.revealHint(s, mooncat, me.id, T0 + 2000)
    expect(dexHintsLeft(s, mooncat)).toBe(1)
    s = dexHint(s, mooncat, me.id, T0 + 3000).state
    expect(code(() => dexHint(s, mooncat, me.id, T0 + 4000))).toBe('NO_MORE_HINTS')
  })

  it('only work during the investigation, in a room with Dex', () => {
    const briefing = engine.createSoloRoom('SOLO1', mooncat, me, T0)
    expect(code(() => dexHint(briefing, mooncat, me.id, T0))).toBe('WRONG_PHASE')
    expect(code(() => dexHint(solo(), mooncat, 99, T0))).toBe('NOT_IN_ROOM')

    let crew = engine.createRoom('CREW1', mooncat, { id: 1, name: 'A' }, T0)
    crew = engine.join(crew, { id: 2, name: 'B' }, T0)
    crew = engine.join(crew, { id: 3, name: 'C' }, T0)
    crew = engine.skipBriefing(engine.start(crew, 1, T0), 1, T0)
    expect(code(() => shareNextClue(crew, mooncat, 1, T0))).toBe('NO_DEX')
  })
})

describe('Dex in the view', () => {
  it('shows what Dex shared, and nothing in crew rooms', () => {
    let s = solo()
    const shared = shareNextClue(s, mooncat, me.id, T0 + 2000)
    s = shared.state
    const view = buildView(s, mooncat, me.id, T0 + 3000, {})
    expect(view.mode).toBe('solo')
    expect(view.dex!.shared.map((cl) => cl.id)).toEqual([shared.clueId])
    expect(view.dex!.cluesLeft).toBe(dexHand(s, mooncat).length - 1)
    expect(view.dex!.hintsLeft).toBe(DEX_FREE_HINTS)
    // Dex never shows up as a player.
    expect(view.players.map((p) => p.id)).toEqual([me.id])

    let crew = engine.createRoom('CREW1', mooncat, { id: 1, name: 'A' }, T0)
    crew = engine.join(crew, { id: 2, name: 'B' }, T0)
    crew = engine.join(crew, { id: 3, name: 'C' }, T0)
    expect(buildView(engine.start(crew, 1, T0), mooncat, 1, T0, {}).dex).toBeNull()
  })
})

describe('fallback lines', () => {
  it('name the clue, and have something for a hint', () => {
    const clue = mooncat.clues[0]
    expect(fallbackDexLine({ ask: 'clue', clue, hints: [], sharedCount: 4 })).toContain(clue.title)
    expect(fallbackDexLine({ ask: 'hint', hint: mooncat.hints[0], hints: [], sharedCount: 0 }).length).toBeGreaterThan(0)
  })
})

describe('room sync', () => {
  it("doesn't poll solo rooms", () => {
    expect(pollMs('solo', false)).toBeNull()
    expect(pollMs('solo', true)).toBeNull()
  })

  it('polls crew rooms no faster than every 30 s while Realtime is connected', () => {
    expect(pollMs('crew', true)).toBe(POLL_LIVE_MS)
    expect(POLL_LIVE_MS).toBeGreaterThanOrEqual(30_000)
    expect(pollMs('crew', false)).toBe(POLL_FALLBACK_MS)
  })
})
