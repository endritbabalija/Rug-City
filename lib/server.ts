import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { track } from './analytics'
import { env } from './env'
import { getCase } from './cases'
import { GameError } from './game/engine'
import { progressSummary, seasonAt } from './game/progress'
import { hasFreeCase, newPlayer, type Player, type RecentCase } from './player'
import { getSeasons } from './seasons'
import { store } from './store'
import { ConflictError } from './store/types'
import { displayName, InitDataError, validateInitData, type InitData } from './telegram/init-data'

export interface Session {
  player: Player
  init: InitData | null
}

/**
 * Every API call carries `Authorization: tma <initData>`. We verify the signature,
 * then load (or create) the player. Never trust initDataUnsafe from the client.
 */
export async function authenticate(req: Request): Promise<Session> {
  const header = req.headers.get('authorization') ?? ''
  const [scheme, ...rest] = header.split(' ')
  const value = rest.join(' ')
  const cfg = env()

  let profile: { id: number; name: string; username?: string; photoUrl?: string }
  let init: InitData | null = null

  if (scheme === 'tma' && value) {
    init = validateInitData(value, cfg.botToken)
    profile = { id: init.user.id, name: displayName(init.user), username: init.user.username, photoUrl: init.user.photo_url }
  } else if (scheme === 'dev' && cfg.devAuth) {
    const [idRaw, ...nameParts] = value.split(':')
    const id = Number(idRaw)
    if (!Number.isSafeInteger(id) || id <= 0) throw new InitDataError('Bad dev user')
    profile = { id, name: decodeURIComponent(nameParts.join(':')) || `Dev ${id}` }
  } else {
    throw new InitDataError('Open Who Rugged? from Telegram.')
  }

  const db = store()
  let player = await db.getPlayer(profile.id)
  if (!player) {
    // A player who arrives through someone's room link counts as that host's referral.
    const startParam = init ? init.startParam : (req.headers.get('x-start-param') ?? undefined)
    const room = startParam ? await db.getRoom(startParam.toUpperCase()) : null
    player = await db.createPlayer(newPlayer(profile, Date.now(), room?.hostId))
    if (player.referredBy) track('invite_joined', player.id, { referrer: player.referredBy })
  } else if (player.name !== profile.name || player.photoUrl !== profile.photoUrl) {
    player = await db.updatePlayer(profile.id, (p) => ({ ...p, name: profile.name, username: profile.username, photoUrl: profile.photoUrl }))
  }
  // Sentry gives each request its own scope, so this tags only this request's errors.
  Sentry.setTag('player', player.id)
  return { player, init }
}

export function errorResponse(err: unknown, tags: Record<string, string> = {}) {
  if (err instanceof GameError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  if (err instanceof InitDataError)
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: err.message } }, { status: 401 })
  if (err instanceof ZodError || err instanceof SyntaxError)
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid request.' } }, { status: 400 })
  if (err instanceof ConflictError)
    return NextResponse.json({ error: { code: 'BUSY', message: 'Lots happening at once, try again.' } }, { status: 409 })
  console.error(err)
  Sentry.captureException(err, { tags })
  return NextResponse.json({ error: { code: 'SERVER', message: 'Something went wrong.' } }, { status: 500 })
}

export function route<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      return errorResponse(err, await roomTag(ctx))
    }
  }
}

/** The room code from a `[code]` route's params, as a Sentry tag. */
async function roomTag(ctx: unknown): Promise<Record<string, string>> {
  try {
    const params = await (ctx as { params?: Promise<{ code?: unknown }> } | undefined)?.params
    return typeof params?.code === 'string' ? { room: params.code.toUpperCase() } : {}
  } catch {
    return {}
  }
}

/** Cases shown under "Recent cases" on the profile. */
const RECENT_CASES = 10

export async function publicPlayer(p: Player) {
  const now = Date.now()
  const seasons = await getSeasons()
  const [badges, seasonScores, results] = await Promise.all([
    store().getBadges(p.id),
    store().seasonScores(p.id, seasonAt(now, seasons)),
    store().recentResults(p.id, RECENT_CASES),
  ])
  const recent = results.flatMap((r): RecentCase[] => {
    const c = getCase(r.caseId)
    return c ? [{ caseId: r.caseId, title: c.title, at: r.at, points: r.total, correct: r.correct, rating: r.rating, unrated: r.unrated }] : []
  })
  return {
    id: p.id,
    name: p.name,
    caseCredits: p.caseCredits,
    freeCaseAvailable: hasFreeCase(p, now),
    items: p.items,
    badges,
    activeBadge: p.activeBadge ?? null,
    progress: progressSummary(p, now, { seasons, seasonScores, recent }),
  }
}

export type PublicPlayer = Awaited<ReturnType<typeof publicPlayer>>
