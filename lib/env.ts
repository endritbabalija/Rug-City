import 'server-only'

export function env() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    isProd,
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? '',
    appShortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME ?? '',
    appUrl: process.env.APP_URL ?? '',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    /** Feature flags forced on, e.g. `FLAGS=refund_prototype` (local dev and tests). */
    forcedFlags: (process.env.FLAGS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    /** Lets you play in a normal browser as fake users. Never honoured in production. */
    devAuth: !isProd && process.env.DEV_AUTH === '1',
  }
}
