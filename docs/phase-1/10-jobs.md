# 10 · Jobs, cron and broadcasts

## Goal

A simple job queue and scheduled tasks: room cleanup, weekly median solve times, season rollover reminders, admin broadcasts and streak reminders.

## Read first

- `Architecture.md` → decision D
- `DEFAULTS.md` → Cron runner
- `app/api/telegram/webhook/route.ts` (`handleCommand`, admin check, `/season_rewards`), `lib/telegram/bot-api.ts`
- `lib/season.ts` (`grantSeasonRewards`), `lib/seasons.ts`
- Next docs: `route.md`, `maxDuration.md`

## Build

1. **Migration `0009_jobs.sql`.** `jobs (id bigserial, kind text, payload jsonb, run_at timestamptz, attempts int default 0, locked_until timestamptz null, done_at timestamptz null, error text null)`, index on due jobs. SQL function `claim_jobs(p_limit int, p_lock_sec int)` that selects due, unlocked jobs `FOR UPDATE SKIP LOCKED`, sets `locked_until`, returns them. Players get `bot_blocked boolean default false`.
2. **`lib/jobs.ts`.** `enqueue(kind, payload, runAt?)`, `runDue(limit)`, handlers keyed by kind. Failure → `attempts + 1`, retry with backoff (1, 5, 30 min), give up after 5 with `error` set. Store methods with a memory version.
3. **Cron route `app/api/cron/[task]/route.ts`.** Requires `Authorization: Bearer ${CRON_SECRET}`; `maxDuration` set; tasks:

   | Task | When | Does |
   | --- | --- | --- |
   | `tick` | Every minute | `runDue` |
   | `cleanup` | Hourly | Delete rooms and `room_chats` with no update for 7 days |
   | `medians` | Weekly | Per case and mode: `plays`, median and `min_sec` from rated `case_results` into `case_stats` |
   | `season` | Daily | If a season ended: create the next `seasons` row if missing (8 weeks from S4), message admins to run `/season_rewards N` |
   | `streaks` | Daily, 17:00 UTC | Enqueue reminders for players with a streak of 2+ and nothing played today |

4. **Scheduler.** `vercel.json` crons if the project is on Vercel Pro; otherwise a migration that sets up Supabase `pg_cron` + `pg_net` to call the same routes. Document both in `docs/ops/environments.md`.
5. **Broadcast.** Admin command `/broadcast <text>` in `handleCommand` (reuse the admin check): enqueues `broadcast` jobs that each page through up to 500 players (skipping `bot_blocked`), send at about 25 messages a second, and enqueue the next page. A 403 from Telegram sets `bot_blocked`. Replies to the admin with the total when done.

## Tests

- Two overlapping `runDue` calls run each job once.
- Backoff timing and give-up after 5 attempts.
- Broadcast pages through all players and skips blocked ones; a 403 marks the player blocked (mock `botApi`).
- `medians` computes the median correctly for odd and even counts.
- Cron route rejects a missing or wrong secret.

## Done when

- On staging, `tick` runs on schedule and a `/broadcast` reaches the test accounts.
- Done checks pass.

## Out of scope

- Automated prize payouts.

## Needs from Endrit

- Vercel Pro or `pg_cron`. `CRON_SECRET` in each environment.
