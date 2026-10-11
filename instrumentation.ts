import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Errors from Server Components and proxies. API routes report theirs in route() (lib/server.ts).
export const onRequestError = Sentry.captureRequestError
