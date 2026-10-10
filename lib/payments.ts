import 'server-only'
import { randomUUID } from 'node:crypto'
import { getSku } from './catalog'
import { env } from './env'
import { GameError } from './game/engine'
import { applyGrant, type Player } from './player'
import { store } from './store'
import { botApi } from './telegram/bot-api'

/**
 * Telegram Stars flow:
 *  1. Mini app asks us for an invoice link (createInvoiceLink, currency XTR, no provider token).
 *  2. It opens the link with WebApp.openInvoice.
 *  3. Telegram sends pre_checkout_query to the bot webhook; we have 10 seconds to approve it.
 *  4. Telegram sends a message with successful_payment; we grant the items exactly once.
 * The invoice payload is our purchase id, so every step can be checked against the stored row.
 */
export async function createInvoice(player: Player, skuId: string): Promise<{ link: string } | { granted: true }> {
  const sku = getSku(skuId)
  if (!sku) throw new GameError('UNKNOWN_SKU', 'That item does not exist.', 404)
  const cfg = env()

  // Local dev without a bot: grant straight away so the full game can be tested in a browser.
  if (cfg.devAuth && !cfg.botToken) {
    await store().updatePlayer(player.id, (p) => applyGrant(p, sku.grant))
    return { granted: true }
  }

  const id = randomUUID()
  await store().createPurchase({ id, userId: player.id, sku: sku.id, stars: sku.stars, status: 'pending', createdAt: Date.now() })
  const link = await botApi<string>('createInvoiceLink', {
    title: sku.title,
    description: sku.description,
    payload: id,
    currency: 'XTR',
    prices: [{ label: sku.title, amount: sku.stars }],
  })
  return { link }
}

interface PreCheckoutQuery {
  id: string
  from: { id: number }
  currency: string
  total_amount: number
  invoice_payload: string
}

export async function handlePreCheckout(q: PreCheckoutQuery) {
  const purchase = await store().getPurchase(q.invoice_payload)
  const sku = purchase && getSku(purchase.sku)
  const ok =
    !!purchase &&
    !!sku &&
    purchase.status === 'pending' &&
    purchase.userId === q.from.id &&
    q.currency === 'XTR' &&
    q.total_amount === purchase.stars
  await botApi('answerPreCheckoutQuery', ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: 'This order expired. Please try again from the shop.' })
}

interface SuccessfulPayment {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
}

/** Idempotent: Telegram may deliver the same update twice. */
export async function handleSuccessfulPayment(fromId: number, pay: SuccessfulPayment) {
  const purchase = await store().transitionPurchase(pay.invoice_payload, 'pending', 'paid', pay.telegram_payment_charge_id)
  if (!purchase) return null
  const sku = getSku(purchase.sku)!
  try {
    await store().updatePlayer(purchase.userId, (p) => applyGrant(p, sku.grant))
  } catch (err) {
    // Put it back so Telegram's retry of this update can grant it.
    await store().transitionPurchase(purchase.id, 'paid', 'pending')
    throw err
  }
  return sku
}

/** Admin-initiated refund: returns the Stars and takes the items back where possible. */
export async function refundCharge(chargeId: string) {
  const purchase = await store().getPurchaseByCharge(chargeId)
  if (!purchase) throw new Error('No purchase with that charge id')
  if (purchase.status !== 'paid') throw new Error(`Purchase is ${purchase.status}`)
  await botApi('refundStarPayment', { user_id: purchase.userId, telegram_payment_charge_id: chargeId })
  await store().transitionPurchase(purchase.id, 'paid', 'refunded')
  const sku = getSku(purchase.sku)!
  await store().updatePlayer(purchase.userId, (p) => applyGrant(p, sku.grant, -1))
  return purchase
}
