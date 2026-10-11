import 'server-only'
import { randomInt } from 'node:crypto'
import { suspectReply } from './ai/suspect'
import { getCase } from './cases'
import type { CaseFile } from './cases/types'
import type { ItemKey } from './catalog'
import { badgeInfo } from './catalog'
import { env } from './env'
import * as engine from './game/engine'
import { GameError } from './game/engine'
import { awardCase, REFERRAL_POINTS, seasonRating } from './game/progress'
import type { Award, RoomState, Vote } from './game/types'
import { buildView } from './game/view'
import { applyGrant, consumeCase, hasFreeCase, spendItem, type Player } from './player'
import { store } from './store'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function newCode() {
  return Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
}

export function normalizeCode(code: string) {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{5}$/.test(c)) throw new GameError('BAD_CODE', 'That case code looks wrong.', 404)
  return c
}

function requireCase(id: string): CaseFile {
  const c = getCase(id)
  if (!c) throw new GameError('UNKNOWN_CASE', 'Unknown case.', 404)
  return c
}

async function loadRoom(code: string) {
  const room = await store().getRoom(code)
  if (!room) throw new GameError('NO_ROOM', 'This case has closed or never existed.', 404)
  return { room, caseFile: requireCase(room.caseId) }
}

/** Admins (ADMIN_TELEGRAM_IDS) can host a case alone to test it in production. */
function minPlayersFor(hostId: number) {
  const cfg = env()
  return cfg.adminIds.includes(hostId) ? 1 : cfg.minPlayers
}

const badgeOf = (p: Player) => (p.activeBadge ? badgeInfo(p.activeBadge)?.icon : undefined)

export async function createRoom(player: Player, caseId: string) {
  const c = requireCase(caseId)
  for (let i = 0; i < 5; i++) {
    const state = engine.createRoom(newCode(), c, { id: player.id, name: player.name, badge: badgeOf(player) }, Date.now())
    if (await store().createRoom(state)) return state.code
  }
  throw new Error('Could not allocate a room code')
}

export async function viewRoom(code: string, player: Player) {
  const { room, caseFile } = await loadRoom(code)
  return { ...buildView(room, caseFile, player.id, Date.now()), member: engine.isMember(room, player.id), minPlayers: minPlayersFor(room.hostId) }
}

/** Run a pure engine step against the stored room with optimistic concurrency. */
async function mutate(code: string, step: (s: RoomState, c: CaseFile, now: number) => RoomState) {
  const { caseFile } = await loadRoom(code)
  return store().updateRoom(code, (s) => step(s, caseFile, Date.now()))
}

/**
 * Charge the player, apply the room step, and refund if the step fails.
 * The step is validated against the current room first so we rarely need the refund.
 */
async function chargedStep(
  code: string,
  player: Player,
  charge: (p: Player) => Player,
  refund: (p: Player) => Player,
  step: (s: RoomState, c: CaseFile, now: number) => RoomState,
) {
  const { room, caseFile } = await loadRoom(code)
  step(room, caseFile, Date.now()) // dry run: throws GameError before we take anything
  await store().updatePlayer(player.id, charge)
  try {
    return await mutate(code, step)
  } catch (err) {
    await store().updatePlayer(player.id, refund)
    throw err
  }
}

function itemCharge(item: ItemKey) {
  return [(p: Player) => spendItem(p, item), (p: Player) => applyGrant(p, { items: { [item]: 1 } })] as const
}

export type RoomAction =
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'ready' }
  | { type: 'skip' }
  | { type: 'callVote' }
  | { type: 'vote'; vote: Vote }
  | { type: 'closeVote' }
  | { type: 'hint' }
  | { type: 'trace'; walletId: string }
  | { type: 'subpoena'; suspectId: string }

export async function act(code: string, player: Player, action: RoomAction) {
  const me = { id: player.id, name: player.name, badge: badgeOf(player) }
  switch (action.type) {
    case 'join':
      return mutate(code, (s, _c, now) => engine.join(s, me, now))
    case 'leave':
      return mutate(code, (s, _c, now) => engine.leave(s, player.id, now))
    case 'start': {
      const minPlayers = minPlayersFor(player.id)
      let usedFree = false
      return chargedStep(
        code,
        player,
        (p) => {
          usedFree = hasFreeCase(p, Date.now())
          return consumeCase(p, Date.now())
        },
        (p) => (usedFree ? { ...p, freeCaseDay: undefined } : { ...p, caseCredits: p.caseCredits + 1 }),
        (s, _c, now) => engine.start(s, player.id, now, minPlayers),
      )
    }
    case 'ready':
      return mutate(code, (s, _c, now) => engine.ready(s, player.id, now))
    case 'skip':
      return mutate(code, (s, _c, now) => engine.skipBriefing(s, player.id, now))
    case 'callVote':
      return mutate(code, (s, _c, now) => engine.callVote(s, player.id, now))
    case 'vote':
      return settleAfter(await mutate(code, (s, c, now) => engine.castVote(s, c, player.id, action.vote, now)))
    case 'closeVote':
      return settleAfter(await mutate(code, (s, c, now) => engine.closeVote(s, c, player.id, now)))
    case 'hint':
      return chargedStep(code, player, ...itemCharge('hint'), (s, c, now) => engine.revealHint(s, c, player.id, now))
    case 'trace':
      return chargedStep(code, player, ...itemCharge('trace'), (s, c, now) => engine.trace(s, c, player.id, action.walletId, now))
    case 'subpoena':
      return chargedStep(code, player, ...itemCharge('subpoena'), (s, c, now) => engine.subpoena(s, c, player.id, action.suspectId, now))
  }
}

export async function ask(code: string, player: Player, suspectId: string, text: string) {
  const { caseFile } = await loadRoom(code)
  const suspect = caseFile.suspects.find((s) => s.id === suspectId)
  if (!suspect) throw new GameError('UNKNOWN_SUSPECT', 'Unknown suspect.', 404)

  let subpoenaed = false
  const asked = await store().updateRoom(code, (s) => {
    const r = engine.askSuspect(s, caseFile, player.id, suspectId, text, Date.now())
    subpoenaed = r.subpoenaed
    return r.state
  })

  let reply: string
  try {
    reply = await suspectReply(caseFile, suspect, asked.chats[engine.chatKey(player.id, suspectId)] ?? [], subpoenaed)
  } catch (err) {
    await store().updateRoom(code, (s) => engine.refundQuestion(s, player.id, suspectId, subpoenaed))
    throw err
  }
  return store().updateRoom(code, (s) => engine.suspectReply(s, player.id, suspectId, reply, Date.now(), subpoenaed))
}

/**
 * Runs once per finished room: Clue Points and season ratings for every seat, plus the
 * referral bonus (once a referred player finishes their first rated case, they and the
 * host who brought them each get a free case, and the host gets Clue Points).
 *
 * The room is claimed first so no second request can settle it again. After that every
 * seat settles independently: one failing write never blocks the other players, and the
 * awards that did succeed are always written back so the verdict screen can show them.
 */
async function settleAfter(state: RoomState) {
  if (state.phase !== 'reveal' || state.rewardsSettled || !state.result) return state
  let claimed = false
  const settled = await store().updateRoom(state.code, (s) => {
    claimed = !s.rewardsSettled
    return { ...s, rewardsSettled: true }
  })
  if (!claimed) return settled

  const caseFile = requireCase(settled.caseId)
  const now = Date.now()
  const awards: Record<string, Award> = {}
  await Promise.all(
    settled.seats.map(async (id) => {
      try {
        const award = await settleSeat(settled, caseFile, id, now)
        awards[String(id)] = award
      } catch (err) {
        console.error('Settling seat failed', settled.code, id, err)
      }
    }),
  )
  return store().updateRoom(state.code, (s) => ({ ...s, awards }))
}

async function settleSeat(room: RoomState, caseFile: CaseFile, id: number, now: number) {
  let referrer: number | undefined
  let award: Award | undefined
  let ratingChanged = false
  const player = await store().updatePlayer(id, (p) => {
    const r = awardCase(p, { caseFile, seats: room.seats.length, vote: room.votes[String(id)], result: room.result!, assisted: !!room.assisted, now })
    award = r.award
    ratingChanged = r.ratingChanged
    referrer = undefined
    // The referral pays out on the friend's first case that counts, not just any finish.
    if (!p.referredBy || p.referralSettled || r.award.unrated) return r.player
    referrer = p.referredBy
    return { ...r.player, referralSettled: true, caseCredits: r.player.caseCredits + 1 }
  })

  // Bookkeeping after the player's points are safe: a failure here costs a leaderboard
  // refresh or a referral bonus, never the points themselves.
  if (ratingChanged) {
    const { rating, cases } = seasonRating(player, now)
    await store()
      .raiseSeasonRating({ season: player.season!.id, playerId: id, name: player.name, badge: badgeOf(player), rating, cases, updatedAt: now })
      .catch((err) => console.error('Leaderboard write failed', id, err))
  }
  if (referrer) {
    try {
      if (await store().getPlayer(referrer)) {
        await store().updatePlayer(referrer, (p) => ({ ...p, caseCredits: p.caseCredits + 1, cluePoints: (p.cluePoints ?? 0) + REFERRAL_POINTS }))
      }
    } catch (err) {
      console.error('Referral bonus failed', referrer, err)
    }
  }
  return award!
}
