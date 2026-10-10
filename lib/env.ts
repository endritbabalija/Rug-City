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
    adminIds: (process.env.ADMIN_TELEGRAM_IDS ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Boolean),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    suspectModel: process.env.SUSPECT_MODEL || 'claude-haiku-5-5',
    /** Lets you play in a normal browser as fake users. Never honoured in production. */
    devAuth: !isProd && process.env.DEV_AUTH === '1',
    minPlayers: !isProd && process.env.DEV_MIN_PLAYERS ? Number(process.env.DEV_MIN_PLAYERS) : 3,
  }
}
