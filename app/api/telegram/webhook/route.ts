import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { handlePreCheckout, handleSuccessfulPayment, refundCharge } from '@/lib/payments'
import { grantSeasonRewards } from '@/lib/season'
import { botApi, miniAppLink } from '@/lib/telegram/bot-api'

interface Message {
  message_id: number
  chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' }
  from?: { id: number; first_name: string }
  text?: string
  successful_payment?: Parameters<typeof handleSuccessfulPayment>[1]
}

interface Update {
  update_id: number
  message?: Message
  pre_checkout_query?: Parameters<typeof handlePreCheckout>[0]
}

function secretMatches(given: string | null, expected: string) {
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const openButton = (text: string, startParam?: string) => ({
  inline_keyboard: [[{ text, url: miniAppLink(startParam) }]],
})

async function reply(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await botApi('sendMessage', { chat_id: chatId, text, ...extra })
}

async function handleCommand(msg: Message) {
  const [rawCommand, ...args] = (msg.text ?? '').trim().split(/\s+/)
  const command = rawCommand.split('@')[0].toLowerCase()
  const chatId = msg.chat.id

  switch (command) {
    case '/start': {
      const code = args[0]?.toUpperCase()
      if (code && /^[A-Z0-9]{5}$/.test(code)) {
        return reply(chatId, `🕵️ You've been called in on case ${code}.`, { reply_markup: openButton('Join the case', code) })
      }
      return reply(
        chatId,
        "🕵️ Who Rugged?\n\nA crypto project just got rugged. Work out who did it, why, and where the money went: solo with Detective Dex, or with 2–5 friends.\n\nAdd me to your group chat and send /play, or open the game below.",
        { reply_markup: openButton('Open Who Rugged?') },
      )
    }
    case '/play':
      return reply(chatId, '🚨 New case incoming. The host opens the game and picks a case, then everyone joins from the invite link.', {
        reply_markup: openButton('Open the case files'),
      })
    case '/paysupport':
      return reply(
        chatId,
        'Payment problem? Reply here with what you bought and when, and include the receipt from your Telegram Stars history. We reply within 48 hours and refund failed deliveries in Stars.',
      )
    case '/refund': {
      // Admin only: /refund <telegram_payment_charge_id>
      if (!msg.from || !env().adminIds.includes(msg.from.id)) return
      if (!args[0]) return reply(chatId, 'Usage: /refund <telegram_payment_charge_id>')
      try {
        const p = await refundCharge(args[0])
        return reply(chatId, `Refunded ${p.stars}⭐ for ${p.sku} to user ${p.userId}.`)
      } catch (err) {
        return reply(chatId, `Refund failed: ${(err as Error).message}`)
      }
    }
    case '/season_rewards': {
      // Admin only: /season_rewards <season>. Safe to repeat; nobody is rewarded twice.
      if (!msg.from || !env().adminIds.includes(msg.from.id)) return
      const season = Number(args[0])
      if (!args[0]) return reply(chatId, 'Usage: /season_rewards <season number>')
      try {
        const r = await grantSeasonRewards(season)
        return reply(chatId, `Season ${r.season}: ${r.ranked} ranked, ${r.rewarded} in the reward zone, ${r.granted} newly rewarded.`)
      } catch (err) {
        return reply(chatId, `Season rewards failed: ${(err as Error).message}`)
      }
    }
  }
}

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get('x-telegram-bot-api-secret-token'), env().webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = (await req.json()) as Update

  if (update.message?.successful_payment && update.message.from) {
    // Let errors surface as 500 here: Telegram retries, and fulfilment is idempotent.
    const sku = await handleSuccessfulPayment(update.message.from.id, update.message.successful_payment)
    if (sku) await reply(update.message.chat.id, `${sku.icon} ${sku.title} added. Happy hunting, detective.`).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  try {
    if (update.pre_checkout_query) {
      await handlePreCheckout(update.pre_checkout_query)
    } else if (update.message?.text?.startsWith('/')) {
      await handleCommand(update.message)
    }
  } catch (err) {
    // Returning 200 stops Telegram from retrying forever; the error is in the logs.
    console.error('Webhook error', update.update_id, err)
  }
  return NextResponse.json({ ok: true })
}
