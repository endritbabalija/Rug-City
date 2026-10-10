import { ImageResponse } from 'next/og'
import { getCase } from '@/lib/cases'
import { store } from '@/lib/store'

// Public on purpose: Telegram fetches this URL when a player shares the verdict to their story.
// It never shows the culprit, so sharing it can't spoil the case for anyone.

type Ctx = { params: Promise<{ code: string }> }

const INK = '#0f0e0c'
const PAPER = '#efe7d6'
const RED = '#e3412b'
const TAPE = '#f2c230'

export async function GET(_req: Request, { params }: Ctx) {
  const code = (await params).code.toUpperCase().replace(/\.PNG$/, '')
  const room = /^[A-Z0-9]{5}$/.test(code) ? await store().getRoom(code) : null
  const c = room && getCase(room.caseId)
  if (!room || !c || room.phase !== 'reveal' || !room.result) return new Response('Not found', { status: 404 })

  const r = room.result
  const minutes = Math.max(1, Math.round(r.elapsedSec / 60))
  const caught = r.correct.culprit
  const headline = caught ? `Our crew caught the rugger in ${minutes} min` : 'The rugger got away'
  const crew = room.players.map((p) => `${p.badge ? p.badge + ' ' : ''}${p.name}`).join(' · ')
  const rows: [string, boolean][] = [
    ['Who did it', r.correct.culprit],
    ['Why', r.correct.motive],
    ['Where the money went', r.correct.trail],
  ]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: INK, color: PAPER, padding: 80, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', height: 36, background: `repeating-linear-gradient(-45deg, ${TAPE} 0 40px, ${INK} 40px 80px)`, margin: '-80px -80px 80px' }} />
        <div style={{ display: 'flex', fontSize: 40, letterSpacing: 8, color: TAPE }}>WHO RUGGED? · CASE {code}</div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, lineHeight: 1.02, marginTop: 40 }}>{c.title}</div>
        <div style={{ display: 'flex', fontSize: 38, opacity: 0.7, marginTop: 20 }}>{c.crime}</div>

        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            marginTop: 90,
            padding: '18px 40px',
            border: `10px solid ${caught ? RED : PAPER}`,
            color: caught ? RED : PAPER,
            fontSize: 110,
            fontWeight: 900,
            letterSpacing: 6,
            transform: 'rotate(-6deg)',
          }}
        >
          {caught ? 'CASE CLOSED' : 'COLD CASE'}
        </div>

        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, marginTop: 90, lineHeight: 1.1 }}>{headline}</div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60, background: PAPER, color: INK, padding: 48, borderRadius: 8 }}>
          {rows.map(([label, ok]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 44, padding: '14px 0', borderBottom: `3px dashed ${INK}33` }}>
              <span>{label}</span>
              <span style={{ display: 'flex', alignItems: 'center', color: ok ? '#1d7a3a' : RED, fontWeight: 800 }}>
                <span style={{ display: 'flex', width: 26, height: 26, borderRadius: 13, background: ok ? '#1d7a3a' : RED, marginRight: 16 }} />
                {ok ? 'SOLVED' : 'MISSED'}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 64, fontWeight: 900, marginTop: 28 }}>
            <span>Score</span>
            <span>{r.score} / 120</span>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 34, opacity: 0.75, marginTop: 50 }}>{crew}</div>
        <div style={{ display: 'flex', flexGrow: 1 }} />
        <div style={{ display: 'flex', fontSize: 40, color: TAPE }}>Think your crew is faster? Play Who Rugged? on Telegram.</div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
