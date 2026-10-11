import { describe, expect, it } from 'vitest'
import { mooncat } from '@/lib/cases/mooncat'
import * as engine from '@/lib/game/engine'
import { GameError } from '@/lib/game/engine'
import { ACCUSE_GRACE_MS, INVESTIGATE_MS, QUESTIONS_PER_PLAYER, type RoomState } from '@/lib/game/types'
import { NO_HELP } from '@/lib/game/scoring'
import { buildView } from '@/lib/game/view'

const T0 = 1_000_000
const people = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Ben' },
  { id: 3, name: 'Cy' },
]

function investigating(): RoomState {
  let s = engine.createRoom('ABCDE', mooncat, people[0], T0)
  s = engine.join(s, people[1], T0)
  s = engine.join(s, people[2], T0)
  s = engine.start(s, 1, T0)
  return engine.skipBriefing(s, 1, T0 + 1000)
}

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as GameError).code
  }
  return null
}

describe('lobby', () => {
  it('requires the minimum players and the host to start', () => {
    let s = engine.createRoom('ABCDE', mooncat, people[0], T0)
    s = engine.join(s, people[1], T0)
    expect(code(() => engine.start(s, 1, T0))).toBe('NOT_ENOUGH_PLAYERS')
    s = engine.join(s, people[2], T0)
    expect(code(() => engine.start(s, 2, T0))).toBe('HOST_ONLY')
    expect(engine.start(s, 1, T0).phase).toBe('briefing')
  })

  it('caps rooms at 6 and blocks joining once started', () => {
    let s = engine.createRoom('ABCDE', mooncat, people[0], T0)
    for (let i = 2; i <= 6; i++) s = engine.join(s, { id: i, name: `P${i}` }, T0)
    expect(code(() => engine.join(s, { id: 7, name: 'P7' }, T0))).toBe('ROOM_FULL')
    const started = engine.start(s, 1, T0)
    expect(code(() => engine.join(started, { id: 8, name: 'late' }, T0))).toBe('WRONG_PHASE')
    // Rejoining as an existing member is always fine.
    expect(engine.join(started, { id: 2, name: 'P2 renamed' }, T0).players[1].name).toBe('P2 renamed')
  })

  it('hands host to the next player when the host leaves the lobby', () => {
    let s = engine.createRoom('ABCDE', mooncat, people[0], T0)
    s = engine.join(s, people[1], T0)
    expect(engine.leave(s, 1, T0).hostId).toBe(2)
  })
})

describe('briefing', () => {
  it('starts the investigation once everyone is ready', () => {
    let s = engine.createRoom('ABCDE', mooncat, people[0], T0)
    s = engine.join(engine.join(s, people[1], T0), people[2], T0)
    s = engine.start(s, 1, T0)
    s = engine.ready(engine.ready(s, 1, T0), 2, T0)
    expect(s.phase).toBe('briefing')
    s = engine.ready(s, 3, T0 + 5)
    expect(s.phase).toBe('investigate')
    expect(s.investigateStartedAt).toBe(T0 + 5)
  })
})

describe('investigation', () => {
  it('only lets players interrogate their own suspects, within the question cap', () => {
    let s = investigating()
    const mine = engine.suspectsFor(s, mooncat, 1)
    const notMine = mooncat.suspects.map((x) => x.id).find((id) => !mine.includes(id))!
    expect(code(() => engine.askSuspect(s, mooncat, 1, notMine))).toBe('NOT_YOUR_SUSPECT')

    for (let i = 0; i < QUESTIONS_PER_PLAYER; i++) {
      s = engine.askSuspect(s, mooncat, 1, mine[0]).state
      s = engine.suspectReply(s, 1, mine[0])
    }
    expect(code(() => engine.askSuspect(s, mooncat, 1, mine[0]))).toBe('OUT_OF_QUESTIONS')

    // A subpoena still buys one truthful answer after the cap.
    s = engine.subpoena(s, mooncat, 1, mine[0], T0)
    const r = engine.askSuspect(s, mooncat, 1, mine[0])
    expect(r.subpoenaed).toBe(true)
    expect(r.state.subpoenas[engine.chatKey(1, mine[0])]).toBeUndefined()
  })

  it('refunds a question whose answer failed', () => {
    let s = investigating()
    const suspect = engine.suspectsFor(s, mooncat, 2)[0]
    s = engine.askSuspect(s, mooncat, 2, suspect).state
    expect(engine.questionsLeft(s, 2)).toBe(QUESTIONS_PER_PLAYER - 1)
    expect(code(() => engine.askSuspect(s, mooncat, 2, suspect))).toBe('WAITING')
    s = engine.refundQuestion(s, 2, suspect, false)
    expect(engine.questionsLeft(s, 2)).toBe(QUESTIONS_PER_PLAYER)
    expect(s.awaiting?.[engine.chatKey(2, suspect)]).toBeUndefined()
  })

  it('reveals traced wallet sources to the whole crew', () => {
    let s = investigating()
    const hidden = (st: RoomState, pid: number) => buildView(st, mooncat, pid, T0, {}).explorer.wallets.find((w) => w.id === 'fw1')!
    expect(hidden(s, 2).fundedBy).toBeNull()
    s = engine.trace(s, mooncat, 1, 'fw1', T0)
    expect(hidden(s, 2).fundedBy).toContain('FX-44817')
    expect(code(() => engine.trace(s, mooncat, 1, 'fw1', T0))).toBe('ALREADY_KNOWN')
    expect(code(() => engine.trace(s, mooncat, 1, 'pool', T0))).toBe('ALREADY_KNOWN')
  })

  it('reveals hints in order and stops at the last one', () => {
    let s = investigating()
    for (let i = 0; i < mooncat.hints.length; i++) s = engine.revealHint(s, mooncat, 3, T0)
    expect(buildView(s, mooncat, 1, T0, {}).hints).toEqual(mooncat.hints)
    expect(code(() => engine.revealHint(s, mooncat, 3, T0))).toBe('NO_MORE_HINTS')
  })

  it('lets only the host call the vote early, anyone in overtime', () => {
    const s = investigating()
    expect(code(() => engine.callVote(s, 2, T0 + 2000))).toBe('HOST_ONLY')
    expect(engine.callVote(s, 2, T0 + 1000 + INVESTIGATE_MS).phase).toBe('accuse')
    expect(engine.callVote(s, 1, T0 + 2000).phase).toBe('accuse')
  })
})

describe('accusation and scoring', () => {
  const right = { culprit: 'brad', motive: 'margin', trail: 'exchange' }
  const wrong = { culprit: 'gary', motive: 'payroll', trail: 'whale' }

  it('reveals automatically when everyone has voted, using the majority', () => {
    let s = engine.callVote(investigating(), 1, T0 + 8 * 60_000)
    s = engine.castVote(s, mooncat, 1, right, T0 + 9 * 60_000)
    s = engine.castVote(s, mooncat, 2, wrong, T0 + 9 * 60_000)
    expect(s.phase).toBe('accuse')
    s = engine.castVote(s, mooncat, 3, right, T0 + 9 * 60_000)
    expect(s.phase).toBe('reveal')
    expect(s.result!.correct).toEqual({ culprit: true, motive: true, trail: true })
    // Under the case's target time gets the full time points.
    expect(s.result!.score).toBe(120)
  })

  it('breaks ties with the host vote', () => {
    let s = engine.callVote(investigating(), 1, T0 + 60_000)
    s = engine.castVote(s, mooncat, 1, wrong, T0 + 60_000)
    s = engine.castVote(s, mooncat, 2, right, T0 + 60_000)
    s = engine.closeVote(s, mooncat, 1, T0 + 60_000)
    expect(s.result!.group.culprit).toBe('gary')
    expect(s.result!.score).toBe(0)
  })

  it('only lets the host close the vote early', () => {
    let s = engine.callVote(investigating(), 1, T0)
    expect(code(() => engine.closeVote(s, mooncat, 1, T0))).toBe('NO_VOTES')
    s = engine.castVote(s, mooncat, 2, right, T0)
    expect(code(() => engine.closeVote(s, mooncat, 2, T0 + 1000))).toBe('HOST_ONLY')
    expect(engine.closeVote(s, mooncat, 2, T0 + ACCUSE_GRACE_MS).phase).toBe('reveal')
  })

  it('rejects unknown options', () => {
    const s = engine.callVote(investigating(), 1, T0)
    expect(code(() => engine.castVote(s, mooncat, 1, { ...right, culprit: 'nobody' }, T0))).toBe('BAD_VOTE')
  })

  it('scores time against the target and only grants it for the right culprit', () => {
    expect(engine.score(mooncat, { ...right, culprit: 'gary' }, 60, 900, NO_HELP).points.time).toBe(0)
    expect(engine.score(mooncat, { ...right, motive: 'payroll' }, 60, 900, NO_HELP).score).toBe(95)
    expect(engine.score(mooncat, right, 1350, 900, NO_HELP).points.time).toBe(10)
  })

  it('uses the target time it is given when the vote ends the case', () => {
    let s = engine.callVote(investigating(), 1, T0)
    const end = T0 + 1000 + 30 * 60_000
    s = engine.castVote(s, mooncat, 1, right, end, 3600)
    s = engine.castVote(s, mooncat, 2, right, end, 3600)
    s = engine.castVote(s, mooncat, 3, right, end, 3600)
    expect(s.result).toMatchObject({ targetSec: 3600, score: 120 })

    // Without one, the case's own target: 30 minutes is twice the 15-minute target, so no time points.
    let d = engine.castVote(engine.callVote(investigating(), 1, T0), mooncat, 1, right, end)
    d = engine.closeVote(d, mooncat, 1, end)
    expect(d.result).toMatchObject({ targetSec: mooncat.targetSec, points: { time: 0 }, score: 100 })
  })

  it('counts every use of help and cuts the whole crew’s score', () => {
    let s = investigating()
    s = engine.revealHint(s, mooncat, 3, T0)
    s = engine.trace(s, mooncat, 1, 'fw1', T0)
    s = engine.subpoena(s, mooncat, 2, engine.suspectsFor(s, mooncat, 2)[0], T0)
    expect(s.help).toEqual({ hint: 1, trace: 1, subpoena: 1, dexHint: 0 })
    s = engine.callVote(s, 1, T0)
    for (const id of [1, 2, 3]) s = engine.castVote(s, mooncat, id, right, T0 + 60_000)
    expect(s.result).toMatchObject({ penalty: 0.5, score: 60, points: { culprit: 50, motive: 25, trail: 25, time: 20 } })
  })

  it('treats rooms from before v2 scoring as crew rooms without help', () => {
    const old = investigating()
    delete old.mode
    delete old.help
    expect(engine.roomMode(old)).toBe('crew')
    expect(engine.revealHint(old, mooncat, 1, T0).help).toEqual({ ...NO_HELP, hint: 1 })
  })
})

describe('view projection', () => {
  it('never leaks other players’ clues or the answer before the reveal', () => {
    const s = investigating()
    const v1 = buildView(s, mooncat, 1, T0, {})
    const v2 = buildView(s, mooncat, 2, T0, {})
    const ids1 = v1.myClues.map((c) => c.id)
    expect(v2.myClues.some((c) => ids1.includes(c.id))).toBe(false)
    expect(v1.result).toBeNull()
    const json = JSON.stringify(v1)
    for (const s of mooncat.suspects) expect(json).not.toContain(s.truth)
    expect(json).not.toContain(mooncat.reveal[0])
  })

  it('shows nothing private to someone outside the case', () => {
    const v = buildView(investigating(), mooncat, 99, T0, {})
    expect(v.myClues).toEqual([])
    expect(v.chats).toEqual({})
  })
})
