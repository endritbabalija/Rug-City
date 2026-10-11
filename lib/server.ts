import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { env } from './env'
import { AppError } from './errors'
import { newPlayer, type Player } from './player'
import { store } from './store'
import { ConflictError } from './store/types'
import { displayName, InitDataError, validateInitData, type InitData } from './telegram/init-data'

export interface Session {
  player: Player
  init: InitData | null
}

type Profile = { id: number; name: string; username?: string; photoUrl?: string }

/** Verify the request's `Authorization` header and read the Telegram user from it. */
function readProfile(req: Request): { profile: Profile; init: InitData | null } {
  const header = req.headers.get('authorization') ?? ''
  const [scheme, ...rest] = header.split(' ')
  const value = rest.join(' ')
  const cfg = env()

  if (scheme === 'tma' && value) {
    const init = validateInitData(value, cfg.botToken)
    const profile = { id: init.user.id, name: displayName(init.user), username: init.user.username, photoUrl: init.user.photo_url }
    return { profile, init }
  }
  if (scheme === 'dev' && cfg.devAuth) {
    const [idRaw, ...nameParts] = value.split(':')
    const id = Number(idRaw)
    if (!Number.isSafeInteger(id) || id <= 0) throw new InitDataError('Bad dev user')
    return { profile: { id, name: decodeURIComponent(nameParts.join(':')) || `Dev ${id}` }, init: null }
  }
  throw new InitDataError('Open Rug City from Telegram.')
}

/**
 * Every API call carries `Authorization: tma <initData>`. We verify the signature,
 * then load (or create) the player. Never trust initDataUnsafe from the client.
 */
export async function authenticate(req: Request): Promise<Session> {
  const { profile, init } = readProfile(req)

  const db = store()
  let player = await db.getPlayer(profile.id)
  if (!player) {
    player = await db.createPlayer(newPlayer(profile, Date.now()))
  } else if (player.name !== profile.name || player.photoUrl !== profile.photoUrl) {
    player = await db.updatePlayer(profile.id, (p) => ({ ...p, name: profile.name, username: profile.username, photoUrl: profile.photoUrl }))
  }
  // Sentry gives each request its own scope, so this tags only this request's errors.
  Sentry.setTag('player', player.id)
  return { player, init }
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  if (err instanceof InitDataError)
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: err.message } }, { status: 401 })
  if (err instanceof ZodError || err instanceof SyntaxError)
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid request.' } }, { status: 400 })
  if (err instanceof ConflictError)
    return NextResponse.json({ error: { code: 'BUSY', message: 'Lots happening at once, try again.' } }, { status: 409 })
  console.error(err)
  Sentry.captureException(err)
  return NextResponse.json({ error: { code: 'SERVER', message: 'Something went wrong.' } }, { status: 500 })
}

export function route<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      return errorResponse(err)
    }
  }
}

/** What the client may know about the signed-in player. */
export const publicPlayer = (p: Player) => ({ id: p.id, name: p.name })

export type PublicPlayer = ReturnType<typeof publicPlayer>
