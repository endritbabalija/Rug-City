// One-time bot setup: webhook, commands and the chat menu button.
// Usage: npm run bot:setup   (reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL from .env.local or the environment)
//
// The Mini App itself (short name used in t.me/<bot>/<app> links) is created in @BotFather
// with /newapp, pointing at APP_URL. Set NEXT_PUBLIC_APP_SHORT_NAME to that short name.

const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret, APP_URL: appUrl } = process.env
if (!token || !secret || !appUrl) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL.')
  process.exit(1)
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error('TELEGRAM_WEBHOOK_SECRET may only contain A-Z, a-z, 0-9, _ and -.')
  process.exit(1)
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method}: ${json.description}`)
  console.log(`✓ ${method}`)
  return json.result
}

const base = appUrl.replace(/\/$/, '')
await call('setWebhook', {
  url: `${base}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
})
await call('setMyCommands', {
  commands: [
    { command: 'start', description: 'Open Rug City' },
  ],
})
await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Play', web_app: { url: base } } })
console.log('Bot is ready.')
