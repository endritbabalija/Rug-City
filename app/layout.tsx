import type { Metadata, Viewport } from 'next'
import { Big_Shoulders_Stencil, Courier_Prime, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const stencil = Big_Shoulders_Stencil({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-stencil', adjustFontFallback: false })
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' })
const typewriter = Courier_Prime({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-typewriter' })
const code = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-code' })

export const metadata: Metadata = {
  title: 'Who Rugged?',
  description: 'A group-chat detective game on Telegram. Work out who rugged, why, and where the money went.',
  robots: 'noindex,nofollow',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f0e0c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${stencil.variable} ${body.variable} ${typewriter.variable} ${code.variable}`}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  )
}
