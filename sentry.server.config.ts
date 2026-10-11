import * as Sentry from '@sentry/nextjs'

// No DSN, no Sentry: local dev and CI send nothing.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
})
