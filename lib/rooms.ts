import 'server-only'
import { randomInt } from 'node:crypto'
import { dexLine, fallbackDexLine } from './ai/dex'
import { suspectReply } from './ai/suspect'
import { track } from './analytics'
import { getCase } from './cases'
import type { CaseFile } from './cases/types'
import type { ItemKey } from './catalog'
import { badgeInfo } from './catalog'
import { env } from './env'
import * as engine from './game/engine'
import { GameError } from './game/engine'
import * as dex from './game/dex'
import { applyAward, awardCase, REFERRAL_POINTS, seasonRating } from './game/progress'
import { targetFor } from './game/scoring'
import { DEX_ID, type Award, type ChatMessage, type RoomState, type Vote } from './game/types'
import { buildView } from './game/view'
import { applyGrant, consumeCase, hasFreeCase, spendItem, type Player } from './player'
import { currentSeason } from './seasons'
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

/** Store a new room under a fresh code. */
async function insertRoom(make: (code: string) => RoomState) {
  for (let i = 0; i < 5; i++) {
    const state = make(newCode())
    if (await store().createRoom(state)) return state
  }
  throw new Error('Could not allocate a room code')
}

export async function createRoom(player: Player, caseId: string) {
  const c = requireCase(caseId)
  return (await insertRoom((code) => engine.createRoom(code, c, { id: player.id, name: player.name, badge: badgeOf(player) }, Date.now()))).code
}

/** Today's free case or a case credit, and the matching refund. */
function caseCharge() {
  let usedFree = false
  return [
    (p: Player) => {
      usedFree = hasFreeCase(p, Date.now())
      return consumeCase(p, Date.now())
    },
    (p: Player) => (usedFree ? { ...p, freeCaseDay: undefined } : { ...p, caseCredits: p.caseCredits + 1 }),
  ] as const
}

/** A solo case with Dex: charged like hosting, refunded if the room can't be created. */
export async function createSolo(player: Player, caseId: string) {
  const c = requireCase(caseId)
  const [charge, refund] = caseCharge()
  await store().updatePlayer(player.id, charge)
  let room: RoomState
  try {
    room = await insertRoom((code) => engine.createSoloRoom(code, c, { id: player.id, name: player.name, badge: badgeOf(player) }, Date.now()))
  } catch (err) {
    await store().updatePlayer(player.id, refund)
    throw err
  }
  track('case_start', player.id, { caseId: c.id, mode: 'solo', seats: 1, code: room.code })
  return room.code
}

/** A player's suspect chats in a room, by suspect id. */
async function loadChats(code: string, playerId: number) {
  const threads: Record<string, ChatMessage[]> = {}
  for (const { suspectId, from, text, at, subpoena } of await store().getChats(code, playerId)) (threads[suspectId] ??= []).push({ from, text, at, subpoena })
  return threads
}

export async function viewRoom(code: string, player: Pick<Player, 'id'>) {
  const [{ room, caseFile }, chats] = await Promise.all([loadRoom(code), loadChats(code, player.id)])
  return { ...buildView(room, caseFile, player.id, Date.now(), chats), member: engine.isMember(room, player.id), minPlayers: minPlayersFor(room.hostId) }
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

/** The case's target time in the room's mode, for the vote that may end it. */
async function targetOf(code: string) {
  const { room, caseFile } = await loadRoom(code)
  // Stats are bookkeeping: if they can't be read, score against the case's own target rather than block the vote.
  const stats = await store()
    .getCaseStats(caseFile.id, engine.roomMode(room))
    .catch((err) => (console.error('Case stats read failed', code, err), null))
  return targetFor(stats, caseFile)
}

function itemCharge(item: ItemKey) {
  return [(p: Player) => spendItem(p, item), (p: Player) => applyGrant(p, { items: { [item]: 1 } }).player] as const
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
  | { type: 'askDex'; ask: dex.DexAsk }

export async function act(code: string, player: Player, action: RoomAction) {
  const me = { id: player.id, name: player.name, badge: badgeOf(player) }
  switch (action.type) {
    case 'join':
      return mutate(code, (s, _c, now) => engine.join(s, me, now))
    case 'leave':
      return mutate(code, (s, _c, now) => engine.leave(s, player.id, now))
    case 'start': {
      const minPlayers = minPlayersFor(player.id)
      const started = await chargedStep(code, player, ...caseCharge(), (s, _c, now) => engine.start(s, player.id, now, minPlayers))
      track('case_start', player.id, { caseId: started.caseId, mode: engine.roomMode(started), seats: started.seats.length, code })
      return started
    }
    case 'ready':
      return mutate(code, (s, _c, now) => engine.ready(s, player.id, now))
    case 'skip':
      return mutate(code, (s, _c, now) => engine.skipBriefing(s, player.id, now))
    case 'callVote':
      return mutate(code, (s, _c, now) => engine.callVote(s, player.id, now))
    case 'vote': {
      const targetSec = await targetOf(code)
      return settleAfter(await mutate(code, (s, c, now) => engine.castVote(s, c, player.id, action.vote, now, targetSec)))
    }
    case 'closeVote': {
      const targetSec = await targetOf(code)
      return settleAfter(await mutate(code, (s, c, now) => engine.closeVote(s, c, player.id, now, targetSec)))
    }
    case 'hint':
      return chargedStep(code, player, ...itemCharge('hint'), (s, c, now) => engine.revealHint(s, c, player.id, now))
    case 'trace':
      return chargedStep(code, player, ...itemCharge('trace'), (s, c, now) => engine.trace(s, c, player.id, action.walletId, now))
    case 'subpoena':
      return chargedStep(code, player, ...itemCharge('subpoena'), (s, c, now) => engine.subpoena(s, c, player.id, action.suspectId, now))
    case 'askDex':
      return askDex(code, player, action.ask)
  }
}

/** Dex hands over his next clue or a hint, then says something about it. */
async function askDex(code: string, player: Player, ask: dex.DexAsk) {
  const { caseFile } = await loadRoom(code)
  let clueId: string | undefined
  let hint: string | undefined
  const room = await store().updateRoom(code, (s) => {
    const now = Date.now()
    if (ask === 'clue') {
      const r = dex.shareNextClue(s, caseFile, player.id, now)
      clueId = r.clueId
      return r.state
    }
    const r = dex.dexHint(s, caseFile, player.id, now)
    hint = r.hint
    return r.state
  })
  track('dex_ask', player.id, { ask, caseId: caseFile.id, code })

  // The clue or hint is already the player's; his line is only flavour, so a failure falls back to the script.
  const clueById = (id: string) => caseFile.clues.find((cl) => cl.id === id)!
  const last = (await store().recentResults(player.id, 2).catch(() => [])).find((r) => r.roomCode !== code)
  const lastCase = last && getCase(last.caseId) ? { title: getCase(last.caseId)!.title, correct: last.correct } : undefined
  const moment = {
    ask,
    clue: clueId ? clueById(clueId) : undefined,
    hint,
    hints: caseFile.hints.slice(0, room.hintsRevealed),
    sharedCount: room.dexShared?.length ?? 0,
    lastCase,
  }
  const text = await dexLine(caseFile, dex.dexHand(room, caseFile).map(clueById), moment, player.id).catch((err) => {
    console.error('Dex line failed', code, err)
    return fallbackDexLine(moment)
  })
  return store().updateRoom(code, (s) => dex.dexSay(s, { ask, text, at: Date.now(), clueId, hint }))
}

export async function ask(code: string, player: Player, suspectId: string, text: string) {
  const { caseFile } = await loadRoom(code)
  const suspect = caseFile.suspects.find((s) => s.id === suspectId)
  if (!suspect) throw new GameError('UNKNOWN_SUSPECT', 'Unknown suspect.', 404)

  let subpoenaed = false
  await store().updateRoom(code, (s) => {
    const r = engine.askSuspect(s, caseFile, player.id, suspectId)
    subpoenaed = r.subpoenaed
    return r.state
  })

  // The room now marks this thread as waiting, so nothing else appends to it until we're done.
  const row = { roomCode: code, playerId: player.id, suspectId, subpoena: subpoenaed || undefined }
  let stored = false
  try {
    const history = (await loadChats(code, player.id))[suspectId] ?? []
    const question: ChatMessage = { from: 'player', text, at: Date.now(), subpoena: row.subpoena }
    await store().appendChat({ ...row, ...question, seq: history.length })
    stored = true
    const reply = await suspectReply(caseFile, suspect, [...history, question], subpoenaed, player.id)
    await store().appendChat({ ...row, from: 'suspect', text: reply, at: Date.now(), seq: history.length + 1 })
  } catch (err) {
    try {
      if (stored) await store().deleteLastChat(code, player.id, suspectId)
    } finally {
      await store().updateRoom(code, (s) => engine.refundQuestion(s, player.id, suspectId, subpoenaed))
    }
    throw err
  }
  return store().updateRoom(code, (s) => engine.suspectReply(s, player.id, suspectId))
}

/**
 * Runs once per finished room: Clue Points and season ratings for every seat, plus the
 * referral bonus (once a referred player finishes their first rated case, they and the
 * host who brought them each get a free case, and the host gets Clue Points).
 *
 * The room is claimed first so no second request can settle it again. After that every
 * seat settles independently: one failing write never blocks the other players, and the
 * awards that did succeed are always written back so the verdict screen can show them.
 * Exported for tests: settling again is safe, since each seat's `case_results` row pays once.
 */
export async function settleAfter(state: RoomState) {
  if (state.phase !== 'reveal' || state.rewardsSettled || !state.result) return state
  let claimed = false
  const settled = await store().updateRoom(state.code, (s) => {
    claimed = !s.rewardsSettled
    return { ...s, rewardsSettled: true }
  })
  if (!claimed) return settled

  const caseFile = requireCase(settled.caseId)
  const now = Date.now()
  // Counted once per room, after the claim. A missed count only delays the switch to the median.
  await store()
    .bumpPlays(caseFile.id, engine.roomMode(settled))
    .catch((err) => console.error('Case plays count failed', settled.code, err))
  const awards: Record<string, Award> = {}
  await Promise.all(
    humanSeats(settled).map(async (id) => {
      try {
        const award = await settleSeat(settled, caseFile, id, now)
        if (award) awards[String(id)] = award
      } catch (err) {
        console.error('Settling seat failed', settled.code, id, err)
      }
    }),
  )
  return store().updateRoom(state.code, (s) => ({ ...s, awards: { ...s.awards, ...awards } }))
}

/** Seats held by players, without Dex. */
const humanSeats = (room: RoomState) => room.seats.filter((id) => id !== DEX_ID)

/** Settles one seat; returns null if this room was already settled for them. */
async function settleSeat(room: RoomState, caseFile: CaseFile, id: number, now: number): Promise<Award | null> {
  const season = await currentSeason(now)
  const [before, alreadyPlayed, seasonScores] = await Promise.all([
    store().getPlayer(id),
    store().hasPlayed(id, caseFile.id),
    store().seasonScores(id, season),
  ])
  if (!before) throw new Error(`Player ${id} not found`)
  const { award, result, ratingChanged } = awardCase(before, {
    code: room.code,
    caseFile,
    mode: engine.roomMode(room),
    seats: humanSeats(room).length,
    vote: room.votes[String(id)],
    result: room.result!,
    now,
    alreadyPlayed,
    seasonScores,
  })

  // The result row is the claim: a second settle of this room finds it and pays nothing.
  if (!(await store().insertCaseResult(result))) return null

  let referrer: number | undefined
  const player = await store().updatePlayer(id, (p) => {
    const next = applyAward(p, award, now)
    referrer = undefined
    // The referral pays out on the friend's first case that counts, not just any finish.
    if (!p.referredBy || p.referralSettled || award.unrated) return next
    referrer = p.referredBy
    return { ...next, referralSettled: true, caseCredits: next.caseCredits + 1 }
  })

  // Bookkeeping after the player's points are safe: a failure here costs a leaderboard
  // refresh or a referral bonus, never the points themselves.
  if (ratingChanged) {
    const { rating, cases } = seasonRating([...seasonScores, award.rating!])
    await store()
      .raiseSeasonRating({ season: season.id, playerId: id, name: player.name, badge: badgeOf(player), rating, cases, updatedAt: now })
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
  track('case_finish', id, {
    caseId: room.caseId,
    code: room.code,
    correct: result.correct,
    total: award.total,
    unrated: award.unrated ?? null,
  })
  return award
}
