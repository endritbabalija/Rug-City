# Rug City

A detective adventure as a Telegram Mini App: uncover the human choices behind fictional crypto scandals, and explain what happened with evidence.

- **Direction:** [`Rug City — Game Direction.md`](./Rug%20City%20—%20Game%20Direction.md)
- **Chapter 1 build brief:** [`Rug City — The Refund Brief.md`](./Rug%20City%20—%20The%20Refund%20Brief.md)
- **Coding rules:** [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) · **Environments:** [`docs/ops/environments.md`](./docs/ops/environments.md)
- **Old design (superseded):** [`docs/archive/`](./docs/archive/)

The earlier crew game (*Who Rugged?*) was removed on 2026-10-11. The code is now the foundation The Refund builds on: Telegram login, storage, feature flags, analytics, error tracking and the noir UI. Home shows a placeholder until The Refund lands.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres) · Telegram Bot API · Sentry. Deploys to Vercel.

## Run it locally (no Telegram needed)

```bash
npm install
cp .env.example .env.local   # DEV_AUTH=1 is all you need to start
npm run dev
```

With no Supabase vars the app uses an in-memory store. Each browser tab can be its own player: `http://localhost:3000/?dev=1&name=Ana`. `DEV_AUTH` is ignored when `NODE_ENV=production`.

```bash
npm test          # init-data, auth, flags, analytics
npm run typecheck
npm run lint
```

Set `FLAGS=refund_prototype` to turn a feature flag on locally. CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build on every push and PR.

## Deploy

1. **Supabase**: create a project and run every file in `supabase/migrations/` in order. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. `node --env-file=.env.local scripts/check-supabase.mjs` checks the setup.
2. **Bot**: create it in @BotFather, then `/newapp` to register the Mini App and pick a short name. Set `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BOT_USERNAME`, `NEXT_PUBLIC_APP_SHORT_NAME` and a random `TELEGRAM_WEBHOOK_SECRET`.
3. **Errors**: set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (optional; Sentry is off without them).
4. Deploy to Vercel with those env vars, set `APP_URL` to the deployment URL, then run:
   ```bash
   npm run bot:setup   # reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL from .env.local
   ```
   That registers the webhook (with the secret), the `/start` command and the chat menu button.

## How the foundation works

| Part | Where | Notes |
| --- | --- | --- |
| Init-data validation | `lib/telegram/init-data.ts`, `lib/server.ts` | Every API call sends `Authorization: tma <initData>`. The server checks the HMAC-SHA256 signature against the bot token and rejects data older than 24 h. `initDataUnsafe` is never trusted. `authenticate()` loads or creates the player. |
| API routes | `lib/server.ts`, `lib/errors.ts` | Wrap every handler in `route()`; throw `AppError` for expected failures, and zod errors become 400s. |
| Storage | `lib/store/*` | One `Store` interface with a Supabase and an in-memory implementation. Writes use compare-and-swap on a `version` column. |
| Feature flags | `lib/flags.ts` | `feature_flags` table, cached 30 s per instance; `FLAGS=` forces flags on locally. |
| Analytics | `lib/analytics.ts` | `track()` writes to `events` after the response is sent and never throws. |
| Bot | `app/api/telegram/webhook`, `scripts/setup-bot.mjs` | Answers `/start` with a button that opens the Mini App. |
| Telegram chrome | `lib/telegram/webapp.ts` | Ready/expand, colours, fullscreen, haptics, BackButton, closing confirmation, sharing to chat. |
| UI | `components/ui.tsx`, `app/globals.css` | Noir paper-and-tape look: Button, Tape, Stamp, Label, Pill, Confirm, Sheet. |
