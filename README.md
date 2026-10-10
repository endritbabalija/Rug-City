# Who Rugged?

A group-chat detective game as a Telegram Mini App. A fictional crypto project gets rugged and a crew of 3–6 friends has about 20 minutes to work out **who did it, why, and where the money went**. Concept: [`Who Rugged — Concept.md`](./Who%20Rugged%20—%20Concept.md).

This is the first version from the concept doc: the three launch cases, the full case loop, Stars purchases, verdict sharing. Bounty Cases, TON payouts, ads, the season pass and solo mode are out of scope until the go/no-go checks.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres + Realtime broadcast) · Telegram Bot API · Claude Haiku 5.5 for live suspect chats. Deploys to Vercel.

## Run it locally (no Telegram needed)

```bash
npm install
cp .env.example .env.local   # DEV_AUTH=1 is all you need to start
npm run dev
```

With no Supabase, bot or AI keys, the app uses an in-memory store, grants shop items instantly and answers suspect questions from scripted lines. Each browser tab is its own player:

- `http://localhost:3000/?dev=1&name=Ana` hosts a case
- `http://localhost:3000/?dev=2&name=Ben&room=K7Q2M` joins room `K7Q2M`
- Set `DEV_MIN_PLAYERS=1` to play a case alone while testing.

`DEV_AUTH` and `DEV_MIN_PLAYERS` are ignored when `NODE_ENV=production`.

```bash
npm test          # engine rules, case solvability, init-data, payments, room flow
npm run typecheck
```

## Deploy

1. **Supabase**: create a project and run `supabase/migrations/0001_init.sql`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Bot**: create it in @BotFather, then `/newapp` to register the Mini App and pick a short name. Set `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BOT_USERNAME`, `NEXT_PUBLIC_APP_SHORT_NAME`, a random `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_TELEGRAM_IDS` (who may `/refund`).
3. **AI**: set `ANTHROPIC_API_KEY` (optional; scripted replies without it). `SUSPECT_MODEL` defaults to `claude-haiku-5-5`.
4. Deploy to Vercel with those env vars, set `APP_URL` to the deployment URL, then run:
   ```bash
   npm run bot:setup   # reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL from .env.local
   ```
   That registers the webhook (with the secret), the `/play` `/start` `/paysupport` commands, and the chat menu button.

## How the Telegram parts work

| Feature | Where | Notes |
| --- | --- | --- |
| Init-data validation | `lib/telegram/init-data.ts`, `lib/server.ts` | Every API call sends `Authorization: tma <initData>`. The server checks the HMAC-SHA256 signature against the bot token and rejects data older than 24 h. `initDataUnsafe` is never trusted. |
| Stars payments | `lib/payments.ts`, `app/api/telegram/webhook` | `createInvoiceLink` with currency `XTR` → `WebApp.openInvoice` → `pre_checkout_query` is checked against the stored purchase (user, amount, status) → `successful_payment` grants items once, keyed on the charge id. Failed grants roll back and return 500 so Telegram retries. Admins refund with `/refund <charge_id>` (`refundStarPayment`); players get `/paysupport`. |
| Story sharing | `app/api/verdict/[code]`, `components/phases/Reveal.tsx` | A 1080×1920 verdict card rendered with `next/og` and shared through `WebApp.shareToStory` with a widget link back to the game. The card never names the culprit, so it can't spoil the case. Falls back to sharing into a chat. |
| Fullscreen | `lib/telegram/webapp.ts`, `components/Room.tsx` | On iOS/Android with Bot API 8.0+, the app goes fullscreen when a case starts, with a toggle in the header. Layout respects `--tg-safe-area-inset-*` and `--tg-content-safe-area-inset-*`. |
| Group play | `components/phases/Lobby.tsx`, webhook `/play` | Invites are direct Mini App links (`t.me/<bot>/<app>?startapp=<code>`) that work in groups; opening one auto-joins the lobby. |
| Native chrome | `lib/telegram/webapp.ts` | BackButton, haptics, closing confirmation mid-case, vertical swipes off, header and background colors set. |

## Game design notes

- **Cases are data** (`lib/cases/*.ts`) and stay on the server. Players only ever receive their own projection (`lib/game/view.ts`): their clues, their suspect chats, and shared explorer data. Hidden funding sources stay masked until someone uses Trace.
- **Clue split**: clues are dealt round-robin in each case's `dealOrder`. `tests/cases.test.ts` checks, for 3, 4, 5 and 6 players, that no single player ever holds a complete proof of the culprit. It's a static stand-in for the doc's blind-solver gate.
- **Rules** live in pure functions (`lib/game/engine.ts`): phases, votes (majority, host breaks ties), power-ups and scoring (culprit 50, motive 25, money trail 25, plus up to 20 for speed when the culprit is right).
- **Economy**: one free hosted case per day, 5-case packs, power-ups (Subpoena, Trace, Hint) and cosmetic badges at the concept doc's Stars prices. Joining someone else's case is free. Referral: when an invited player finishes their first case, they and the host each get a free case.
- **AI cost control**: suspect chats are capped at 6 questions per player per case. A Subpoena forces one truthful answer and doesn't count against the cap. The system prompt is cached per suspect, so every group playing a case shares the prefix.
- **Storage**: rooms and players are versioned JSON docs updated with compare-and-swap. Clients get a Realtime broadcast ping with no payload and refetch through the authenticated API, so nothing private crosses the socket. Polling every 4 s backs that up.
