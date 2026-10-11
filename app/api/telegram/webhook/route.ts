import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { botApi, miniAppLink } from '@/lib/telegram/bot-api'

interface Message {
  message_id: number
  chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' }
  from?: { id: number; first_name: string }
  text?: string
}

interface Update {
  update_id: number
  message?: Message
}

function secretMatches(given: string | null, expected: string) {
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function handleCommand(msg: Message) {
  const command = (msg.text ?? '').trim().split(/\s+/)[0].split('@')[0].toLowerCase()
  if (command !== '/start') return
  await botApi('sendMessage', {
    chat_id: msg.chat.id,
    text: '🕵️ Rug City\n\nA detective agency, a missing refund and a client who wants someone else blamed. Work out what really happened, with evidence.',
    reply_markup: { inline_keyboard: [[{ text: 'Open Rug City', url: miniAppLink() }]] },
  })
}

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get('x-telegram-bot-api-secret-token'), env().webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = (await req.json()) as Update
  try {
    if (update.message?.text?.startsWith('/')) await handleCommand(update.message)
  } catch (err) {
    // Returning 200 stops Telegram from retrying forever; the error is in the logs.
    console.error('Webhook error', update.update_id, err)
  }
  return NextResponse.json({ ok: true })
}
