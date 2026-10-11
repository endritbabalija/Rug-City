# Architecture

Oct 11, 2026 · @endrit

How Rug City is built so it can grow to thousands of daily players without a rewrite: keep the current stack, change how data is stored and synced, and add the pieces Game Design v2 needs (background jobs, analytics, content in the database, rate limits, a real dev process).

## Verdict

The stack stays: Next.js on Vercel, Supabase Postgres, Telegram Mini App, Claude Haiku for live chat. What changes is how it is used.

**Already solid, keep as is**

- **Auth:** every request carries Telegram init data, checked by signature on the server. The client is never trusted.
- **Pure game rules:** `lib/game/engine.ts` and `lib/game/progress.ts` are pure, tested functions. The same engine can run solo, crew, Daily and later The Mole.
- **Private projections:** case data stays on the server; each player only receives their own view (`lib/game/view.ts`).
- **Payments:** Stars purchases are idempotent per charge id, with refunds.
- **Store interface:** `lib/store/types.ts` hides the database, so tests and local dev run on the in-memory store.

**What breaks or gets expensive as players grow**

| Problem | Today | Why it matters at scale |
| --- | --- | --- |
| Polling | Every player in a room fetches it every 4 s, plus once per realtime ping; each fetch reads the player and the full room | ~250 requests/s and ~500 DB reads/s per 1,000 players in cases, mostly for nothing. Solo would poll too |
| JSON blobs | Each player and each room is one JSON document, rewritten whole on every change (compare-and-swap with retries) | Player docs grow forever (`playedCases`) and v2 adds HQ, informants, Wanted Board; suspect chats live inside the room doc, so players in one room collide; gate metrics can't be queried |
| No background work | No cron, no queue; old rooms are never deleted | Dex acting in crews, weekly medians, season rollover, broadcasts and cleanup all need it |
| No rate limits | AI chat has a per-case cap only | AI calls cost money per request; anti-cheat requires rate limits |
| Cases in code | Cases are TypeScript files in `lib/cases/` | 5 new cases a week would mean 5 deploys a week |
| No visibility | `console.error` only; no analytics, error tracking, CI or staging | Can't measure the phase gates, can't see failures, nothing stops a broken push |

## Principles

1. **Postgres is the source of truth.** Anything we need to count, rank or report lives in typed tables, not inside JSON.
2. **Rules stay pure.** Game logic lives in pure functions with unit tests; routes and the store only load, call and save.
3. **The server decides, the client displays.** Clients never hold hidden case data or compute scores.
4. **Idempotent writes.** Every reward, purchase and job can run twice without paying twice (unique keys, claim-then-act).
5. **Boring until it hurts.** Postgres for queues and rate limits first; add Redis or a separate service only when numbers say so.
6. **Every gate is measurable.** If a phase gate depends on a number, the event that produces it is logged from day one.

## System overview

| Part | Role | Notes |
| --- | --- | --- |
| Telegram Mini App (Next.js client) | All screens | Talks only to our API, with `Authorization: tma <initData>` |
| API routes (Next.js on Vercel) | Auth, game actions, views | Stateless; one function region, same region as Supabase |
| Supabase Postgres | All data | Accessed only by the server with the secret key; RLS on, no policies |
| Supabase Realtime | "Room changed" pings | Broadcast with no payload; clients refetch their own view |
| Vercel Cron | Scheduled work | Drains the job table, runs season rollover, weekly medians, cleanup |
| Telegram Bot API | Invites, payments, messages | Webhook at `/api/telegram/webhook` |
| Anthropic API | Suspect chat, Dex, case drafting | Haiku for live chat; a stronger model offline in the case pipeline |
| Sentry | Errors | Client and server |

## Decisions

### A · Room sync: ping first, poll as backup

- Realtime ping stays the main signal. Polling drops from 4 s to about 30 s and only runs while the socket is down or the tab just came back.
- **Solo cases don't poll at all.** Every action response already returns the fresh view.
- Room reads use a light auth path: verify the signature and take the player id from init data, without loading the full player record.
- Pings stay payload-free, so nothing private crosses the socket.

### B · Data model: tables for players, JSON only for live rooms

The live room stays one JSON document. It is small, short-lived and fits compare-and-swap well. Everything else moves to typed tables.

| Table | Holds | Replaces |
| --- | --- | --- |
| `players` | Profile, inventory (case credits, items), counters (Clue Points, streak, free-case days, day-one cases left) as columns | Most of `players.doc` |
| `case_results` | One row per player per finished case: mode (solo/crew), seats, correct answers, score, help penalties, elapsed time, points, rated or why not. Unique on (player, case) for rated results | `playedCases`, `recent`, season `scores` |
| `season_ratings` | Leaderboard per season (exists today) | — |
| `seasons` | Id, start, end | The fixed `SEASON_EPOCH` and `SEASON_MS` math, so seasons can have different lengths |
| `room_chats` | One row per suspect chat message (room, player, suspect, seq) | `chats` inside the room doc |
| `player_badges` | Owned badges | `badges` array |
| `events` | Append-only product events: name, player, properties, time | Nothing today |
| `purchases` | Stars purchases (exists today) | — |

- The awarding logic stays the pure `awardCase` function. The result is written as an insert-once `case_results` row, and the small `players` row is updated with compare-and-swap. A player's own writes rarely collide, so retries stay cheap.
- Phase 2 tables (`hq_rooms`, `informants`, `wanted_board`) follow the same pattern when they arrive. Informant tips are computed from timestamps when the player opens the app, so they need no background job.
- **Migration:** add the new tables, backfill them from `players.doc` with a one-off script, switch reads and writes, keep `doc` for one release as a fallback, then drop it.

### C · Cases live in Postgres

| Table | Holds |
| --- | --- |
| `cases` | Id, district, status (`draft` → `review` → `live` → `retired`), release time, version, the case JSON (same shape as `CaseFile`) |
| `case_stats` | Per case and mode (solo/crew): plays, target time, median solve time, minimum plausible time |
| `daily_puzzles` / `daily_results` | One puzzle per UTC day; one result per player per day |

- The three existing cases become seed data, and the solvability test runs against the database copy.
- The case pipeline (an offline script, not part of the app) drafts cases with AI, runs the blind solver check, and inserts them as `review`. You approve them in an admin screen, which sets them `live` with a release time.
- Live cases are cached in server memory per version, so case reads don't hit the database on every request.

### D · Background work: Vercel Cron + a Postgres job table

- A `jobs` table (kind, payload, run at, attempts, locked until, done). A cron route claims due jobs with `FOR UPDATE SKIP LOCKED` (through a Postgres function), runs them, and retries with backoff.
- Short follow-ups to a request (for example Dex's turn after a player acts) run with Next.js `after()`. Anything that must survive a failure goes in the job table.
- Scheduled jobs:

| Job | When |
| --- | --- |
| Drain job queue | Every minute |
| Close stale rooms and delete old ones | Hourly |
| Recalculate median solve times | Weekly |
| Season rollover and rewards | At each season end (admin-approved while prizes are involved) |
| Streak reminders, broadcasts | Queued as jobs, sent at about 25 messages/s to stay under Telegram's limit |

### E · Rate limits and anti-cheat

- One Postgres function `hit_rate_limit(key, limit, window)` that counts and checks atomically. Applied per player to AI chat, room actions, room creation and Daily submits.
- **Impossible solve time:** a finish faster than the case's minimum plausible time (from `case_stats`) is saved but unrated, and logged as an `events` row for review.
- Existing rules stay: one account per Telegram id (signed init data), points only from finished cases, no points for replays, daily cap on rated cases.
- A per-player daily AI budget caps cost even inside the rate limits.
- Move rate limits to Upstash Redis only if the Postgres function shows up as hot.

### F · Analytics and errors

- **Events table** in our own database, so gate numbers come from our data and SQL. Starting events: `app_open`, `case_start`, `case_finish`, `daily_finish`, `purchase`, `invite_sent`, `invite_joined`, `ai_call` (with tokens and cost), `cheat_flag`.
- SQL views for the gates: day-1 and day-7 retention, share of paying players, case completion rate, AI cost per session.
- **Sentry** for client and server errors, with the room code and player id as tags.

### G · Dev process

| Environment | Store | Telegram bot | Deploys from |
| --- | --- | --- | --- |
| Local | In-memory (or a local Supabase) | None (`DEV_AUTH`) | `npm run dev` |
| Staging | Separate Supabase project | Separate staging bot | Vercel preview deploys of every branch |
| Production | Production Supabase project | Rug City bot | `main` |

- **CI (GitHub Actions)** on every push and PR: typecheck, lint, tests, build. `main` only takes green PRs.
- **Migrations** only through `supabase/migrations`, applied to staging first, then production.
- **Feature flags:** a small config table, so unfinished or undecided features (most of v2 is still open) ship switched off and turn on without a deploy.
- Integration tests keep running against the in-memory store; a smaller set runs against staging Supabase before a release.

## AI

| Use | Model | Cost control |
| --- | --- | --- |
| Suspect chat | Haiku | Per-case question cap, per-player daily budget, prompt cache per suspect |
| Dex (hints, banter, crew seat) | Haiku | Short replies; hints are scripted per case where possible, with AI only for banter |
| Case drafting and blind solver | A stronger model, offline | Runs in the pipeline script, never on a player's request |

Every AI call logs tokens and cost as an `ai_call` event, so cost per session is measured, not estimated. If the model fails, chat falls back to scripted lines, as it does today.

## When we outgrow this

| Scale (daily players) | What changes |
| --- | --- |
| Up to ~10,000 | This document as written |
| ~10,000–50,000 | Bigger Supabase compute; Redis for rate limits; edge-cached Daily and case content; leaderboard served from a materialized view |
| 50,000+ | Read replica for leaderboards and analytics; move analytics events to a separate store; consider a dedicated realtime game server for The Mole |

## Build order

1. **Foundation:** CI, staging (Supabase project, bot, previews), Sentry, events table. (G, F)
2. **Room sync fix.** (A)
3. **Data model migration** with backfill. (B)
4. **With the Phase 1 features that need them:** cases in Postgres and the pipeline (C), job table and cron (D), rate limits and solve-time checks (E).

## Open questions

- Which Vercel function region and which Supabase region? They should be the same.
- Which Supabase plan for production? The free tier pauses after inactivity and has a small database.
- Sentry, or an alternative you already use?
- Admin screen for case review and broadcasts: inside the Mini App behind `ADMIN_TELEGRAM_IDS`, or a separate web page?
