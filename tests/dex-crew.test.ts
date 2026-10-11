import { describe, expect, it } from 'vitest'
import { dexPrompt, dexTurn } from '@/lib/ai/dex'
import { CASES } from '@/lib/cases'
import { mooncat } from '@/lib/cases/mooncat'
import * as engine from '@/lib/game/engine'
import { GameError } from '@/lib/game/engine'
import { addDex, DEX_RELEASE_SCHEDULE, dexHand, dexHint, dexNextReleaseAt, dexReleased, removeDex, shareNextClue } from '@/lib/game/dex'
import { DEX_ID, MAX_PLAYERS, MIN_HUMANS_WITH_DEX, MIN_PLAYERS, type RoomState } from '@/lib/game/types'
import { buildView } from '@/lib/game/view'

const T0 = 1_000_000
const { firstMs, everyMs } = DEX_RELEASE_SCHEDULE

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as GameError).code
  }
  return null
}

/** A crew lobby with `humans` players (ids 1..n, host 1). */
function lobby(humans: number, c = mooncat): RoomState {
  let s = engine.createRoom('CREW1', c, { id: 1, name: 'P1' }, T0)
  for (let id = 2; id <= humans; id++) s = engine.join(s, { id, name: `P${id}` }, T0)
  return s
}

/** 2 humans + Dex, investigation started at T0. */
function investigating(c = mooncat): RoomState {
  const s = engine.start(addDex(lobby(MIN_HUMANS_WITH_DEX, c), 1, T0), 1, T0)
  return engine.skipBriefing(s, 1, T0)
}

describe('seating Dex', () => {
  it('lets only the host add and remove him, in the lobby', () => {
    const s = lobby(2)
    expect(code(() => addDex(s, 2, T0))).toBe('HOST_ONLY')
    const seated = addDex(s, 1, T0)
    expect(seated.dexSeated).toBe(true)
    expect(code(() => addDex(seated, 1, T0))).toBe('DEX_SEATED')
    expect(code(() => removeDex(seated, 2, T0))).toBe('HOST_ONLY')
    expect(removeDex(seated, 1, T0).dexSeated).toBe(false)
    expect(code(() => removeDex(s, 1, T0))).toBe('NO_DEX')

    const started = engine.start(seated, 1, T0)
    expect(code(() => removeDex(started, 1, T0))).toBe('WRONG_PHASE')
    expect(code(() => addDex(engine.createSoloRoom('SOLO1', mooncat, { id: 1, name: 'P1' }, T0), 1, T0))).toBe('WRONG_PHASE')
  })

  it("counts toward MAX_PLAYERS: he can't join a full room, and a full room can't take another player", () => {
    expect(code(() => addDex(lobby(MAX_PLAYERS), 1, T0))).toBe('ROOM_FULL')
    const almost = addDex(lobby(MAX_PLAYERS - 1), 1, T0)
    expect(code(() => engine.join(almost, { id: 99, name: 'Late' }, T0))).toBe('ROOM_FULL')
  })
})

describe('starting with Dex', () => {
  it(`needs ${MIN_PLAYERS} humans without Dex and ${MIN_HUMANS_WITH_DEX} with him`, () => {
    expect(code(() => engine.start(lobby(MIN_PLAYERS - 1), 1, T0))).toBe('NOT_ENOUGH_PLAYERS')
    expect(engine.start(lobby(MIN_PLAYERS), 1, T0).phase).toBe('briefing')

    expect(code(() => engine.start(addDex(lobby(MIN_HUMANS_WITH_DEX - 1), 1, T0), 1, T0))).toBe('NOT_ENOUGH_PLAYERS')
    expect(engine.start(addDex(lobby(MIN_HUMANS_WITH_DEX), 1, T0), 1, T0).phase).toBe('briefing')
  })

  it('never raises a lower minimum (admins and dev hosts)', () => {
    expect(engine.minHumans(addDex(lobby(1), 1, T0), 1)).toBe(1)
    expect(engine.start(addDex(lobby(1), 1, T0), 1, T0, 1).seats).toEqual([1, DEX_ID])
  })

  it('seats the humans then Dex, and stays a crew room', () => {
    const s = engine.start(addDex(lobby(2), 1, T0), 1, T0)
    expect(s.mode).toBe('crew')
    expect(s.seats).toEqual([1, 2, DEX_ID])
    expect(s.players.map((p) => p.id)).toEqual([1, 2])
  })
})

describe('the vote', () => {
  it('never waits for Dex: it closes when every human has voted', () => {
    let s = engine.callVote(investigating(), 1, T0 + 60_000)
    s = engine.castVote(s, mooncat, 1, mooncat.answer, T0 + 61_000)
    expect(s.phase).toBe('accuse')
    s = engine.castVote(s, mooncat, 2, mooncat.answer, T0 + 62_000)
    expect(s.phase).toBe('reveal')
    expect(Object.keys(s.votes)).not.toContain(String(DEX_ID))
  })
})

describe.each(CASES.map((c) => [c.title, c] as const))('Dex releasing clues on %s', (_title, c) => {
  it('releases nothing before the first boundary, then one clue per boundary', () => {
    const s = investigating(c)
    const hand = dexHand(s, c)
    expect(hand.length).toBeGreaterThan(0)
    for (let i = 0; i < hand.length; i++) {
      const at = T0 + firstMs + i * everyMs
      expect(dexReleased(s, c, at - 1)).toEqual(hand.slice(0, i))
      expect(dexReleased(s, c, at)).toEqual(hand.slice(0, i + 1))
      expect(dexNextReleaseAt(s, c, at - 1)).toBe(at)
    }
    const end = T0 + firstMs + hand.length * everyMs
    expect(dexReleased(s, c, end)).toEqual(hand)
    expect(dexNextReleaseAt(s, c, end)).toBeNull()
  })

  it('covers every clue between the humans and Dex', () => {
    const s = investigating(c)
    const all = [...engine.cluesFor(s, c, 1), ...engine.cluesFor(s, c, 2), ...dexHand(s, c)]
    expect(all.sort()).toEqual(c.clues.map((cl) => cl.id).sort())
  })
})

describe('Dex in the crew view', () => {
  it('shows released clues to every player, with a feed line per release', () => {
    const s = investigating()
    const hand = dexHand(s, mooncat)
    const at = T0 + firstMs + everyMs
    for (const id of [1, 2]) {
      const view = buildView(s, mooncat, id, at, {})
      expect(view.dex!.shared.map((cl) => cl.id)).toEqual(hand.slice(0, 2))
      expect(view.dex!.cluesLeft).toBe(hand.length - 2)
      expect(view.dex!.nextReleaseAt).toBe(at + everyMs)
      const lines = view.feed.filter((f) => f.playerId === DEX_ID && f.text.startsWith('Dex shared a note'))
      expect(lines.map((f) => f.at)).toEqual([T0 + firstMs, at])
      // Dex is never listed as a player.
      expect(view.players.map((p) => p.id)).toEqual([1, 2])
    }
    // Nothing yet just before the first release.
    expect(buildView(s, mooncat, 1, T0 + firstMs - 1, {}).dex!.shared).toEqual([])
  })

  it('shows Dex seated in the lobby', () => {
    expect(buildView(addDex(lobby(2), 1, T0), mooncat, 2, T0, {}).dexSeated).toBe(true)
    expect(buildView(lobby(2), mooncat, 2, T0, {}).dexSeated).toBe(false)
  })
})

describe('asking Dex in a crew', () => {
  it("doesn't hand clues over on request; they come on the timer", () => {
    expect(code(() => shareNextClue(investigating(), mooncat, 1, T0))).toBe('DEX_ON_TIMER')
  })

  it('gives any player a hint, shared on the board with the room-wide penalty', () => {
    const r = dexHint(investigating(), mooncat, 2, T0 + 5000)
    expect(r.hint).toBe(mooncat.hints[0])
    expect(r.state.hintsRevealed).toBe(1)
    expect(engine.roomHelp(r.state).dexHint).toBe(1)
    expect(r.state.feed.at(-1)).toMatchObject({ playerId: DEX_ID, text: 'P2 asked Dex for a hint.' })
    expect(buildView(r.state, mooncat, 1, T0 + 6000, {}).hints).toEqual([mooncat.hints[0]])
  })
})

describe("Dex's lines", () => {
  it('ask for one or two sentences that never restate the clue', () => {
    const prompt = dexPrompt(mooncat, [])
    expect(prompt).toMatch(/1 or 2 short sentences/)
    expect(prompt).toMatch(/Never restate/)
    expect(dexTurn({ ask: 'hint', hint: mooncat.hints[0], hints: [], sharedCount: 0, crew: true })).toMatch(/^Someone in the crew/)
  })
})
