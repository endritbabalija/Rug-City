# Rug City

A detective adventure as a Telegram Mini App: uncover the human choices behind fictional crypto scandals, and explain what happened with evidence. Where the game is going: [`Rug City — Game Direction.md`](./Rug%20City%20—%20Game%20Direction.md).

The code below is the earlier version (formerly *Who Rugged?*): a crew case loop with votes, Stars purchases, districts, ranks and an AI case pipeline. The rest of this README describes that code as it is. Old design docs and build briefs are in [`docs/archive/`](./docs/archive/); coding rules are in [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md).

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
npm run lint
```

Set `FLAGS=solo,daily` to turn feature flags on locally. CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build on every push and PR. Local, staging and production setup: [`docs/ops/environments.md`](./docs/ops/environments.md).

## Deploy

1. **Supabase**: create a project and run every file in `supabase/migrations/` in order. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. A database that already had players before `0004_player_tables.sql` also needs `node --env-file=.env.local scripts/backfill-v2.mjs` once (back up first; `--dry-run` prints what it would do).
2. **Bot**: create it in @BotFather, then `/newapp` to register the Mini App and pick a short name. Set `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BOT_USERNAME`, `NEXT_PUBLIC_APP_SHORT_NAME`, a random `TELEGRAM_WEBHOOK_SECRET`, and `ADMIN_TELEGRAM_IDS` (who may `/refund`).
3. **AI**: set `ANTHROPIC_API_KEY` (optional; scripted replies without it). `SUSPECT_MODEL` defaults to `claude-haiku-5-5`.
   **Errors**: set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (optional; Sentry is off without them).
4. Deploy to Vercel with those env vars, set `APP_URL` to the deployment URL, then run:
   ```bash
   npm run bot:setup   # reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL from .env.local
   ```
   That registers the webhook (with the secret), the `/play` `/start` `/paysupport` commands, and the chat menu button.

## New cases

Cases live in the `cases` table; the three in `lib/cases/*.ts` are built in. New ones are drafted by a model, checked by a blind solver, and released by an admin (docs/archive/phase-1/06-case-pipeline.md). Both scripts read `.env.local` and need `ANTHROPIC_API_KEY` and the Supabase keys.

```bash
npm run cases:draft -- --district memecoin-swamp --count 4   # draft, check, store passing ones as 'review'
npm run cases:check -- <id> [--save]                         # re-run the checks on a stored or built-in case
```

Each case is a draft plus about 40 solver calls, and up to 2 revisions when the solver finds it unfair. That's a few dollars per case on `claude-opus-5-5` (the default for `CASE_MODEL` and `SOLVER_MODEL`), or about $0.20 with `CASE_MODEL=claude-haiku-5-5 SOLVER_MODEL=claude-haiku-5-5`, which the first batch used. An unscoped API key also needs `ANTHROPIC_WORKSPACE_ID`. Admins (`ADMIN_TELEGRAM_IDS`) review cases in the app: Home → Review, then playtest (free and unrated), approve with a release time and target, or reject.

## How the Telegram parts work

| Feature | Where | Notes |
| --- | --- | --- |
| Init-data validation | `lib/telegram/init-data.ts`, `lib/server.ts` | Every API call sends `Authorization: tma <initData>`. The server checks the HMAC-SHA256 signature against the bot token and rejects data older than 24 h. `initDataUnsafe` is never trusted. |
| Stars payments | `lib/payments.ts`, `app/api/telegram/webhook` | `createInvoiceLink` with currency `XTR` → `WebApp.openInvoice` → `pre_checkout_query` is checked against the stored purchase (user, amount, status) → `successful_payment` grants items once, keyed on the charge id. Failed grants roll back and return 500 so Telegram retries. Admins refund with `/refund <charge_id>` (`refundStarPayment`); players get `/paysupport`. |
| Story sharing | `app/api/verdict/[code]`, `components/phases/Reveal.tsx` | A 1080×1920 verdict card rendered with `next/og` and shared through `WebApp.shareToStory` with a widget link back to the game. The card never names the culprit, so it can't spoil the case. Falls back to sharing into a chat. |
| Fullscreen | `lib/telegram/webapp.ts`, `components/Room.tsx` | On iOS/Android with Bot API 8.0+, the app goes fullscreen when a case starts, with a toggle in the header. Layout respects `--tg-safe-area-inset-*` and `--tg-content-safe-area-inset-*`. |
| Group play | `components/phases/Lobby.tsx`, webhook `/play` | Invites are direct Mini App links (`t.me/<bot>/<app>?startapp=<code>`) that work in groups; opening one auto-joins the lobby. |
| Native chrome | `lib/telegram/webapp.ts` | BackButton, haptics, closing confirmation mid-case, vertical swipes off, header and background colors set. |

## Legacy game design notes

How the earlier crew game works. The Refund is built separately (see `Rug City — The Refund Brief.md`).

- **Cases are data** (`lib/cases/*.ts`) and stay on the server. Players only ever receive their own projection (`lib/game/view.ts`): their clues, their suspect chats, and shared explorer data. Hidden funding sources stay masked until someone uses Trace.
- **Clue split**: clues are dealt round-robin in each case's `dealOrder`. `tests/cases.test.ts` checks, for 3, 4, 5 and 6 players, that no single player ever holds a complete proof of the culprit. It's a static stand-in for the doc's blind-solver gate.
- **Rules** live in pure functions (`lib/game/engine.ts`): phases, votes (majority, host breaks ties), power-ups and scoring (culprit 50, motive 25, money trail 25, plus up to 20 for speed when the culprit is right).
- **Economy**: one free hosted case per day, 5-case packs, power-ups (Subpoena, Trace, Hint) and cosmetic badges at the concept doc's Stars prices. Joining someone else's case is free. Referral: when an invited player finishes their first case, they and the host each get a free case.
- **AI cost control**: suspect chats are capped at 6 questions per player per case. A Subpoena forces one truthful answer and doesn't count against the cap. The system prompt is cached per suspect, so every group playing a case shares the prefix.
- **Storage**: rooms and players are versioned JSON docs updated with compare-and-swap. Clients get a Realtime broadcast ping with no payload and refetch through the authenticated API, so nothing private crosses the socket. Polling every 4 s backs that up.
