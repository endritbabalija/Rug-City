'use client'

// Thin typed wrapper over window.Telegram.WebApp (https://core.telegram.org/bots/webapps).
// Only the parts this game uses are typed. Every call is guarded by version so the app
// still works on older clients and in a plain browser during development.

type HapticImpact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type HapticNotice = 'error' | 'success' | 'warning'

interface BackButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name: string } }
  version: string
  platform: string
  isFullscreen?: boolean
  isVersionAtLeast(v: string): boolean
  ready(): void
  expand(): void
  close(): void
  requestFullscreen?(): void
  exitFullscreen?(): void
  disableVerticalSwipes?(): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  setBottomBarColor?(color: string): void
  openTelegramLink(url: string): void
  onEvent(event: string, cb: (...args: unknown[]) => void): void
  offEvent(event: string, cb: (...args: unknown[]) => void): void
  BackButton: BackButton
  HapticFeedback: {
    impactOccurred(style: HapticImpact): void
    notificationOccurred(type: HapticNotice): void
    selectionChanged(): void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

const INK = '#0f0e0c'

export function webApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  const wa = window.Telegram?.WebApp
  // The script defines WebApp even in a normal browser; initData is only set inside Telegram.
  return wa && wa.initData ? wa : null
}

const atLeast = (v: string) => !!webApp()?.isVersionAtLeast(v)

export function isMobileClient() {
  const p = webApp()?.platform
  return p === 'ios' || p === 'android'
}

export function initTelegram() {
  const wa = webApp()
  if (!wa) return
  wa.ready()
  wa.expand()
  if (atLeast('6.1')) {
    wa.setHeaderColor(INK)
    wa.setBackgroundColor(INK)
  }
  if (atLeast('7.10')) wa.setBottomBarColor?.(INK)
  // Scrolling evidence lists shouldn't swipe the app closed.
  if (atLeast('7.7')) wa.disableVerticalSwipes?.()
}

// ── Fullscreen (Bot API 8.0) ──────────────────────────────────────────────

export const canFullscreen = () => atLeast('8.0') && isMobileClient()

export function setFullscreen(on: boolean) {
  const wa = webApp()
  if (!wa || !canFullscreen()) return
  if (on && !wa.isFullscreen) wa.requestFullscreen?.()
  if (!on && wa.isFullscreen) wa.exitFullscreen?.()
}

export function onFullscreenChange(cb: (on: boolean) => void) {
  const wa = webApp()
  if (!wa) return () => {}
  const handler = () => cb(!!wa.isFullscreen)
  wa.onEvent('fullscreenChanged', handler)
  return () => wa.offEvent('fullscreenChanged', handler)
}

// ── Haptics ───────────────────────────────────────────────────────────────

export const haptic = {
  tap: () => atLeast('6.1') && webApp()?.HapticFeedback.impactOccurred('light'),
  thud: () => atLeast('6.1') && webApp()?.HapticFeedback.impactOccurred('heavy'),
  ok: () => atLeast('6.1') && webApp()?.HapticFeedback.notificationOccurred('success'),
  error: () => atLeast('6.1') && webApp()?.HapticFeedback.notificationOccurred('error'),
  select: () => atLeast('6.1') && webApp()?.HapticFeedback.selectionChanged(),
}

// ── Navigation chrome ─────────────────────────────────────────────────────

export function bindBackButton(cb: (() => void) | null) {
  const wa = webApp()
  if (!wa || !atLeast('6.1')) return () => {}
  if (!cb) {
    wa.BackButton.hide()
    return () => {}
  }
  wa.BackButton.show()
  wa.BackButton.onClick(cb)
  return () => {
    wa.BackButton.offClick(cb)
    wa.BackButton.hide()
  }
}

export function setClosingConfirmation(on: boolean) {
  const wa = webApp()
  if (!wa || !atLeast('6.2')) return
  if (on) wa.enableClosingConfirmation()
  else wa.disableClosingConfirmation()
}

// ── Sharing ───────────────────────────────────────────────────────────────

export function shareToChat(url: string, text: string) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  const wa = webApp()
  if (wa) wa.openTelegramLink(share)
  else window.open(share, '_blank', 'noopener')
}
