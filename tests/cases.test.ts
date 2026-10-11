import { describe, expect, it } from 'vitest'
import { CASES } from '@/lib/cases'
import { dealClues, dealSuspects } from '@/lib/game/engine'

// Static checks standing in for the concept doc's "blind solver" gate:
// every case must be internally consistent, and no single player may ever hold
// a complete proof of the culprit on their own, for any group size from 3 to 6.

describe.each(CASES.map((c) => [c.title, c] as const))('%s', (_title, c) => {
  const clueIds = new Set(c.clues.map((cl) => cl.id))
  const suspectIds = new Set(c.suspects.map((s) => s.id))
  const walletIds = new Set(c.wallets.map((w) => w.id))

  it('deals every clue exactly once', () => {
    expect([...c.dealOrder].sort()).toEqual([...clueIds].sort())
  })

  it('has a target time', () => {
    expect(Number.isInteger(c.targetSec) && c.targetSec > 0).toBe(true)
  })

  it('has a valid answer', () => {
    expect(suspectIds.has(c.answer.culprit)).toBe(true)
    expect(c.motives.some((m) => m.id === c.answer.motive)).toBe(true)
    expect(c.trails.some((t) => t.id === c.answer.trail)).toBe(true)
  })

  it('only references known wallets in transactions', () => {
    for (const t of c.txs) {
      expect(walletIds.has(t.from), t.id).toBe(true)
      expect(walletIds.has(t.to), t.id).toBe(true)
    }
  })

  it('has culprit proofs made of real clues', () => {
    expect(c.culpritProofs.length).toBeGreaterThan(0)
    for (const proof of c.culpritProofs) for (const id of proof) expect(clueIds.has(id), id).toBe(true)
  })

  it('has at least two red herrings besides the culprit', () => {
    expect(c.suspects.length).toBeGreaterThanOrEqual(3)
  })

  it('has unique ids', () => {
    expect(clueIds.size).toBe(c.clues.length)
    expect(suspectIds.size).toBe(c.suspects.length)
    expect(walletIds.size).toBe(c.wallets.length)
  })

  for (const n of [3, 4, 5, 6]) {
    describe(`with ${n} players`, () => {
      const hands = dealClues(c, n)
      const suspectHands = dealSuspects(c, n)

      it('gives every player at least one clue and one suspect', () => {
        for (const h of hands) expect(h.length).toBeGreaterThan(0)
        for (const h of suspectHands) expect(h.length).toBeGreaterThan(0)
        for (const h of suspectHands) expect(h.length).toBeLessThanOrEqual(2)
      })

      it('lets every suspect talk to someone', () => {
        expect(new Set(suspectHands.flat())).toEqual(suspectIds)
      })

      it('never lets one player prove the culprit alone', () => {
        for (const [seat, hand] of hands.entries()) {
          for (const proof of c.culpritProofs) {
            expect(proof.every((id) => hand.includes(id)), `seat ${seat} holds ${proof.join('+')}`).toBe(false)
          }
        }
      })
    })
  }
})
