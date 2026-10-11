// Pure game rules. Every function takes the current room state and returns a new
// one (or throws GameError), so the same logic runs against any store and is unit-tested.

import type { CaseFile } from '../cases/types'
import { caseScore, NO_HELP } from './scoring'
import {
  ACCUSE_GRACE_MS,
  DEX_ID,
  INVESTIGATE_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  QUESTIONS_PER_PLAYER,
  type CaseMode,
  type Help,
  type RoomResult,
  type RoomState,
  type Vote,
} from './types'

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

const fail = (code: string, message: string, status = 400): never => {
  throw new GameError(code, message, status)
}

export const chatKey = (playerId: number, suspectId: string) => `${playerId}:${suspectId}`

export function isMember(state: RoomState, playerId: number) {
  return state.players.some((p) => p.id === playerId)
}

export function requireMember(state: RoomState, playerId: number) {
  if (!isMember(state, playerId)) fail('NOT_IN_ROOM', "You're not in this case.", 403)
}

export function requirePhase(state: RoomState, ...phases: RoomState['phase'][]) {
  if (!phases.includes(state.phase)) fail('WRONG_PHASE', 'That is not possible right now.', 409)
}

function setPhase(state: RoomState, phase: RoomState['phase'], now: number): RoomState {
  return { ...state, phase, phaseStartedAt: now }
}

export function log(state: RoomState, playerId: number, text: string, now: number): RoomState {
  return { ...state, feed: [...state.feed, { at: now, playerId, text }].slice(-60) }
}

function nameOf(state: RoomState, playerId: number) {
  return state.players.find((p) => p.id === playerId)?.name ?? 'Someone'
}

export const roomMode = (state: RoomState): CaseMode => state.mode ?? 'crew'
export const roomHelp = (state: RoomState): Help => ({ ...NO_HELP, ...state.help })

export function addHelp(state: RoomState, kind: keyof Help): RoomState {
  const help = roomHelp(state)
  return { ...state, help: { ...help, [kind]: help[kind] + 1 } }
}

// ── Dealing ────────────────────────────────────────────────────────────────

/** Deal clues round-robin in the case's deal order. Index = seat. */
export function dealClues(c: CaseFile, seatCount: number): string[][] {
  const hands: string[][] = Array.from({ length: seatCount }, () => [])
  c.dealOrder.forEach((clueId, i) => hands[i % seatCount].push(clueId))
  return hands
}

/** Each seat gets one or two suspects who DM them; suspects wrap if seats outnumber them. */
export function dealSuspects(c: CaseFile, seatCount: number): string[][] {
  const hands: string[][] = Array.from({ length: seatCount }, () => [])
  const total = Math.max(c.suspects.length, seatCount)
  for (let i = 0; i < total; i++) {
    const hand = hands[i % seatCount]
    const suspect = c.suspects[i % c.suspects.length].id
    if (!hand.includes(suspect)) hand.push(suspect)
  }
  return hands
}

export function seatOf(state: RoomState, playerId: number) {
  return state.seats.indexOf(playerId)
}

export function cluesFor(state: RoomState, c: CaseFile, playerId: number): string[] {
  const seat = seatOf(state, playerId)
  return seat < 0 ? [] : dealClues(c, state.seats.length)[seat]
}

export function suspectsFor(state: RoomState, c: CaseFile, playerId: number): string[] {
  const seat = seatOf(state, playerId)
  return seat < 0 ? [] : dealSuspects(c, state.seats.length)[seat]
}

// ── Lobby ──────────────────────────────────────────────────────────────────

export function createRoom(
  code: string,
  c: CaseFile,
  host: { id: number; name: string; badge?: string },
  now: number,
): RoomState {
  return {
    code,
    caseId: c.id,
    mode: 'crew',
    hostId: host.id,
    createdAt: now,
    phase: 'lobby',
    phaseStartedAt: now,
    players: [{ ...host, ready: false, joinedAt: now }],
    seats: [],
    awaiting: {},
    questionsUsed: {},
    subpoenas: {},
    traced: [],
    hintsRevealed: 0,
    help: { ...NO_HELP },
    feed: [],
    votes: {},
  }
}

/** A solo case: the player and Dex are seated straight away and the room opens on the briefing. */
export function createSoloRoom(code: string, c: CaseFile, player: { id: number; name: string; badge?: string }, now: number): RoomState {
  const room = createRoom(code, c, player, now)
  return log(setPhase({ ...room, mode: 'solo', seats: [player.id, DEX_ID], dexShared: [], dexMessages: [] }, 'briefing', now), player.id, 'The case file is open.', now)
}

export function join(state: RoomState, player: { id: number; name: string; badge?: string }, now: number): RoomState {
  const existing = state.players.find((p) => p.id === player.id)
  if (existing) {
    // Refresh display name/badge on rejoin, keep everything else.
    return { ...state, players: state.players.map((p) => (p.id === player.id ? { ...p, name: player.name, badge: player.badge } : p)) }
  }
  requirePhase(state, 'lobby')
  if (state.players.length >= MAX_PLAYERS) fail('ROOM_FULL', `This case already has ${MAX_PLAYERS} detectives.`, 409)
  return log({ ...state, players: [...state.players, { ...player, ready: false, joinedAt: now }] }, player.id, `${player.name} joined the case.`, now)
}

export function leave(state: RoomState, playerId: number, now: number): RoomState {
  requireMember(state, playerId)
  requirePhase(state, 'lobby')
  const players = state.players.filter((p) => p.id !== playerId)
  const hostId = state.hostId === playerId && players.length > 0 ? players[0].id : state.hostId
  return log({ ...state, players, hostId }, playerId, `${nameOf(state, playerId)} left.`, now)
}

export function start(state: RoomState, actorId: number, now: number, minPlayers = MIN_PLAYERS): RoomState {
  requirePhase(state, 'lobby')
  if (actorId !== state.hostId) fail('HOST_ONLY', 'Only the host can start the case.', 403)
  if (state.players.length < minPlayers) fail('NOT_ENOUGH_PLAYERS', `You need at least ${minPlayers} detectives.`, 409)
  const seats = state.players.map((p) => p.id)
  return log(setPhase({ ...state, seats }, 'briefing', now), actorId, 'The case file is open.', now)
}

// ── Briefing → investigation ───────────────────────────────────────────────

export function ready(state: RoomState, actorId: number, now: number): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'briefing')
  const players = state.players.map((p) => (p.id === actorId ? { ...p, ready: true } : p))
  const next = { ...state, players }
  return players.every((p) => p.ready) ? beginInvestigation(next, now) : next
}

export function skipBriefing(state: RoomState, actorId: number, now: number): RoomState {
  requirePhase(state, 'briefing')
  if (actorId !== state.hostId) fail('HOST_ONLY', 'Only the host can skip ahead.', 403)
  return beginInvestigation(state, now)
}

function beginInvestigation(state: RoomState, now: number): RoomState {
  return { ...setPhase(state, 'investigate', now), investigateStartedAt: now }
}

export function callVote(state: RoomState, actorId: number, now: number): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  const overtime = now - (state.investigateStartedAt ?? now) >= INVESTIGATE_MS
  if (actorId !== state.hostId && !overtime) fail('HOST_ONLY', 'Only the host can call the vote before time runs out.', 403)
  return log(setPhase(state, 'accuse', now), actorId, `${nameOf(state, actorId)} called the vote.`, now)
}

// ── Power-ups (inventory is charged by the caller) ────────────────────────

export function revealHint(state: RoomState, c: CaseFile, actorId: number, now: number): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  if (state.hintsRevealed >= c.hints.length) fail('NO_MORE_HINTS', 'All hints for this case are already revealed.', 409)
  return log({ ...addHelp(state, 'hint'), hintsRevealed: state.hintsRevealed + 1 }, actorId, `${nameOf(state, actorId)} used a Hint.`, now)
}

export function trace(state: RoomState, c: CaseFile, actorId: number, walletId: string, now: number): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  const wallet = c.wallets.find((w) => w.id === walletId)
  if (!wallet) fail('UNKNOWN_WALLET', 'No such wallet.', 404)
  if (!wallet!.fundingHidden || state.traced.includes(walletId)) fail('ALREADY_KNOWN', "That wallet's source is already visible.", 409)
  return log({ ...addHelp(state, 'trace'), traced: [...state.traced, walletId] }, actorId, `${nameOf(state, actorId)} traced ${wallet!.address}.`, now)
}

export function subpoena(state: RoomState, c: CaseFile, actorId: number, suspectId: string, now: number): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  if (!suspectsFor(state, c, actorId).includes(suspectId)) fail('NOT_YOUR_SUSPECT', "That suspect isn't talking to you.", 403)
  const key = chatKey(actorId, suspectId)
  if (state.subpoenas[key]) fail('ALREADY_SUBPOENAED', 'Your subpoena on this suspect is still waiting for a question.', 409)
  const suspect = c.suspects.find((s) => s.id === suspectId)!
  return log({ ...addHelp(state, 'subpoena'), subpoenas: { ...state.subpoenas, [key]: true } }, actorId, `${nameOf(state, actorId)} subpoenaed ${suspect.name}.`, now)
}

// ── Interrogation ──────────────────────────────────────────────────────────

export function questionsLeft(state: RoomState, playerId: number) {
  return Math.max(0, QUESTIONS_PER_PLAYER - (state.questionsUsed[String(playerId)] ?? 0))
}

/**
 * Counts the player's question and marks the chat as waiting for an answer. Returns whether
 * the answer must be truthful. The caller stores the message itself (`room_chats`).
 */
export function askSuspect(
  state: RoomState,
  c: CaseFile,
  actorId: number,
  suspectId: string,
): { state: RoomState; subpoenaed: boolean } {
  requireMember(state, actorId)
  requirePhase(state, 'investigate')
  if (!suspectsFor(state, c, actorId).includes(suspectId)) fail('NOT_YOUR_SUSPECT', "That suspect isn't talking to you.", 403)
  const key = chatKey(actorId, suspectId)
  const subpoenaed = !!state.subpoenas[key]
  if (!subpoenaed && questionsLeft(state, actorId) <= 0) fail('OUT_OF_QUESTIONS', "You're out of questions. A Subpoena still gets you one true answer.", 409)
  if (state.awaiting?.[key]) fail('WAITING', 'Wait for an answer first.', 409)
  const questionsUsed = subpoenaed
    ? state.questionsUsed
    : { ...state.questionsUsed, [String(actorId)]: (state.questionsUsed[String(actorId)] ?? 0) + 1 }
  const subpoenas = { ...state.subpoenas }
  delete subpoenas[key]
  return { state: { ...state, awaiting: { ...state.awaiting, [key]: true }, questionsUsed, subpoenas }, subpoenaed }
}

function stopAwaiting(state: RoomState, key: string): RoomState {
  const awaiting = { ...state.awaiting }
  delete awaiting[key]
  return { ...state, awaiting }
}

/** The suspect's answer was stored, so the player can ask again. */
export function suspectReply(state: RoomState, actorId: number, suspectId: string): RoomState {
  return stopAwaiting(state, chatKey(actorId, suspectId))
}

/** Undo a question whose answer could not be produced, so the player isn't charged for it. */
export function refundQuestion(state: RoomState, actorId: number, suspectId: string, subpoenaed: boolean): RoomState {
  const key = chatKey(actorId, suspectId)
  if (!state.awaiting?.[key]) return state
  const next = stopAwaiting(state, key)
  if (subpoenaed) return { ...next, subpoenas: { ...next.subpoenas, [key]: true } }
  return { ...next, questionsUsed: { ...next.questionsUsed, [String(actorId)]: Math.max(0, (next.questionsUsed[String(actorId)] ?? 1) - 1) } }
}

// ── Accusation & scoring ───────────────────────────────────────────────────

/** `targetSec` is the case's target time in this room's mode (`targetFor`), used if this vote ends the case. */
export function castVote(state: RoomState, c: CaseFile, actorId: number, vote: Vote, now: number, targetSec = c.targetSec): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'accuse')
  if (!c.suspects.some((s) => s.id === vote.culprit)) fail('BAD_VOTE', 'Unknown suspect.')
  if (!c.motives.some((m) => m.id === vote.motive)) fail('BAD_VOTE', 'Unknown motive.')
  if (!c.trails.some((t) => t.id === vote.trail)) fail('BAD_VOTE', 'Unknown money trail.')
  const next = { ...state, votes: { ...state.votes, [String(actorId)]: vote } }
  const everyone = state.players.every((p) => next.votes[String(p.id)])
  return everyone ? finalize(next, c, now, targetSec) : next
}

export function closeVote(state: RoomState, c: CaseFile, actorId: number, now: number, targetSec = c.targetSec): RoomState {
  requireMember(state, actorId)
  requirePhase(state, 'accuse')
  if (Object.keys(state.votes).length === 0) fail('NO_VOTES', 'Nobody has voted yet.', 409)
  const grace = now - state.phaseStartedAt >= ACCUSE_GRACE_MS
  if (actorId !== state.hostId && !grace) fail('HOST_ONLY', 'Only the host can close the vote early.', 403)
  return finalize(state, c, now, targetSec)
}

function plurality(votes: string[], order: string[], tiebreak?: string): string {
  const counts = new Map<string, number>()
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1)
  const top = Math.max(...counts.values())
  const tied = order.filter((id) => counts.get(id) === top)
  return tiebreak && tied.includes(tiebreak) ? tiebreak : tied[0]
}

/** How many of culprit, motive and money trail a vote got right (0–3). */
export function countCorrect(c: CaseFile, vote: Vote) {
  return Number(vote.culprit === c.answer.culprit) + Number(vote.motive === c.answer.motive) + Number(vote.trail === c.answer.trail)
}

export function score(c: CaseFile, group: Vote, elapsedSec: number, targetSec: number, help: Help): RoomResult {
  const correct = {
    culprit: group.culprit === c.answer.culprit,
    motive: group.motive === c.answer.motive,
    trail: group.trail === c.answer.trail,
  }
  return { group, correct, ...caseScore(correct, elapsedSec, targetSec, help), elapsedSec, targetSec, help }
}

function finalize(state: RoomState, c: CaseFile, now: number, targetSec: number): RoomState {
  const votes = Object.values(state.votes)
  const host = state.votes[String(state.hostId)]
  const group: Vote = {
    culprit: plurality(votes.map((v) => v.culprit), c.suspects.map((s) => s.id), host?.culprit),
    motive: plurality(votes.map((v) => v.motive), c.motives.map((m) => m.id), host?.motive),
    trail: plurality(votes.map((v) => v.trail), c.trails.map((t) => t.id), host?.trail),
  }
  const elapsedSec = Math.round((now - (state.investigateStartedAt ?? state.phaseStartedAt)) / 1000)
  return { ...setPhase(state, 'reveal', now), result: score(c, group, elapsedSec, targetSec, roomHelp(state)) }
}
