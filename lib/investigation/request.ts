import 'server-only'
import { AppError } from '../errors'

/** Investigation requests are small: a few ids. */
const MAX_BODY_BYTES = 4096

/** Read a JSON body, refusing anything over the size limit. Bad JSON throws SyntaxError (a 400). */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new AppError('TOO_LARGE', 'Request too large.', 413)
  return JSON.parse(text)
}
