# Phase 1 Plan

Oct 11, 2026 · @endrit

Phase 1 of Game Design v2, built together with the architecture from Architecture.md: one foundation step, then small feature slices that each bring in the architecture they need. Nothing here is final; each slice is reviewed again before it starts.

**Building it:** the agent-ready brief for each slice, the conventions and the provisional defaults are in [`docs/phase-1/`](docs/phase-1/README.md). Start there.

## Goal

Phase 1 fixes the two biggest gaps: a player can play alone, and has a reason to come back tomorrow.

**What ships** (from the roadmap): Daily puzzle, Clue Points and rank with solo cases rated, Detective Dex as solo partner and as one crew seat, Memecoin Swamp plus two preview cases, 3 free cases on day one, streaks, anti-cheat, the Rug City rename.

**Gate:** 15%+ of players still playing after 7 days, measured from the events table.

## How we work

- **One slice at a time.** Each slice is one branch and one PR, merged only with CI green and after a test on a preview deploy.
- **Behind a flag.** New features ship switched off and are turned on per environment, so `main` is always releasable.
- **Rules stay pure.** New rules go into pure functions with unit tests first; routes and UI come after.
- **Done means:** tests pass, typecheck passes, it works on a preview deploy, and the events it needs are logged.

## Overview

| # | Slice | Game design | Architecture it brings in |
| --- | --- | --- | --- |
| 0 | Foundation | — | CI, preview deploys, Sentry, events table, feature flags (G, F) |
| 1 | Data model | — | Typed player tables, `case_results`, `seasons`, `room_chats`, backfill (B) |
| 2 | Scoring v2 | Rank ladder, every case rated, help penalties, target times | `case_stats` |
| 3 | Solo with Dex | Solo cases, Dex as partner | AI seats, room sync fix (A) |
| 4 | Dex in the crew | Dex fills one crew seat | Next.js `after()` for Dex's turns |
| 5 | Districts | Memecoin Swamp, two locked preview districts | Cases in Postgres (C) |
| 6 | Case pipeline | 12 Memecoin Swamp cases | Pipeline script, admin review screen |
| 7 | First day | 3 free day-one cases as the tutorial | — |
| 8 | Daily | "Who rugged?" daily puzzle, share grid | `daily_puzzles`, `daily_results` |
| 9 | Anti-cheat | Fair ratings | Rate limits, solve-time checks, AI budget (E) |
| 10 | Jobs and broadcasts | Streak reminders, announcements | Job table, Vercel Cron (D) |
| 11 | Launch | Rug City rename, new season | Gate dashboard |

## 0 · Foundation

**Builds**
- GitHub Actions: typecheck, lint, tests and build on every push and PR.
- Preview deploys on the one Supabase project (no separate staging project until real players arrive; see `docs/ops/environments.md`).
- Sentry on client and server, tagged with room code and player id.
- `events` table and a `track(name, playerId, props)` helper. First events: `app_open`, `case_start`, `case_finish`, `purchase`, `invite_joined`, `ai_call`.
- `feature_flags` table and a `flag(name)` helper with a short in-memory cache.

**Tests:** events and flags work against the in-memory store.

**Needs from you:** pick the Supabase plan and region.

## 1 · Data model

**Builds**
- Typed `players` columns for profile, inventory and counters; `player_badges`; `case_results` (one row per player per finished case); `seasons` (start and end per season, replacing the fixed 8-week math); `room_chats` (suspect chats out of the room document).
- `Store` interface and the in-memory store updated to match.
- One-off backfill script from `players.doc`, run after a backup on the shared database. `doc` stays for one release as a fallback, then is dropped.
- Season 1 end date set in the `seasons` table, plus the in-app countdown banner (both easy to change later).

**Tests:** existing engine, progress and flow tests pass unchanged; a backfill test turns sample old documents into the new rows.

## 2 · Scoring v2

**Builds**
- **Rank ladder:** Rookie → Inspector → Chief → Legend, with new thresholds. Existing Clue Points are kept; players simply land on the new ladder.
- **Every finished case is rated**, solo and crew, replacing the 3-seat rule. Replays and the daily cap still earn nothing.
- **Help penalties:** Hint −10%, Trace −15%, Subpoena −25% of the case score, stacking. Replaces "any power-up makes the case unrated". Dex hints count as Hints.
- **Time score** against the case's target time until it has 20 plays in that mode, then against the weekly median. `case_stats` holds target, median and plays per case and mode.

**Tests:** unit tests for penalties, stacking, solo vs crew time targets, the switch at 20 plays, and that a clean solve always beats an aided one.

**Open:** rank thresholds; whether penalties also reduce Clue Points or only the season rating.

## 3 · Solo with Dex

**Builds**
- **AI seats:** a seat can be a player or an AI detective. Dex is the first one. Clues are dealt to Dex's seat like any other seat.
- **Solo case:** you plus Dex, no lobby. Starting one uses a free case or a case credit, like hosting.
- **Dex as partner:** a Dex chat where he shares his clues in his own voice, cracks jokes, and gives a Hint on request (with the Hint penalty).
- **Room sync fix (A):** realtime ping first, polling every ~30 s only as backup, no polling at all in solo; light auth path for room reads.
- Dex's prompt is cached per case like the suspects'; he mentions your last case from `case_results`.

**Tests:** solo flow test from start to verdict; solo results are rated in solo mode; Dex's clues and the player's together contain every clue.

**Open:** does Dex share all his clues at once, or one at a time when asked?

## 4 · Dex in the crew

**Builds**
- The host can add Dex to the lobby, so two friends plus Dex can start a case.
- Dex posts his clues to the group feed during the investigation; his replies run with Next.js `after()` so players never wait on the AI.
- Crew minimum becomes 2 humans when Dex is seated.

**Tests:** flow test with two players and Dex; results count as crew mode.

**Open:** does Dex vote? Recommendation: no. He shares clues and opinions, the humans decide.

## 5 · Districts

**Builds**
- `cases` table (district, status, release time, version, case JSON) and `case_stats`. The three cases move in as seed data; live cases are cached in server memory per version.
- District map on the home screen: Memecoin Swamp open; Sybil Square and DeFi Docks shown locked, each with one playable teaser (`airdrop` and `audit`).
- Districts unlock at a rank; "next case drops on …" when a player has finished everything available.

**Tests:** the solvability test runs against the database copy of each case; unlock rules are unit-tested.

## 6 · Case pipeline

**Builds**
- An offline script (not part of the app): AI drafts a case in the `CaseFile` format, using the three existing cases as examples, then a blind solver plays it with the clues split for 1–6 seats. Unsolvable cases, and cases one seat can solve alone in crew play, are rejected.
- Passing cases are saved as `review`, with a suggested target time from the solver.
- Admin review screen: read a case, play it, adjust the target time, approve or reject. Approval sets it `live` with a release time.
- 12 Memecoin Swamp cases for launch.

**Tests:** schema validation on every drafted case; the existing solvability checks run on every case before it can go live.

**Needs from you:** reviewing and playing the drafted cases.

**Open:** admin screen inside the Mini App (behind `ADMIN_TELEGRAM_IDS`) or a separate web page.

## 7 · First day

**Builds**
- New players get 3 free cases on day one, then one free case a day.
- The first case is the tutorial: a short, easy Memecoin Swamp case with Dex explaining each step once (briefing, clues, explorer, suspects, accusation).
- Events for the funnel: `tutorial_step`, `tutorial_done`.

**Tests:** free-case rules unit-tested across day boundaries; the tutorial case passes the solvability check.

**Open:** a dedicated tutorial case, or the first normal case with Dex's tips switched on.

## 8 · Daily

**Builds**
- One puzzle per UTC day, the same for everyone: a few transactions, pick the insider. One submission per player per day, checked on the server.
- Results, Clue Points for a correct answer, and a Wordle-style spoiler-free share grid.
- `daily_puzzles` and `daily_results` tables; puzzles come from the case pipeline in batches and are reviewed like cases.
- The streak counts a day if you finish the Daily or a case.

**Tests:** one-submission rule, day boundaries, share grid never contains the answer.

**Open:** puzzle formats beyond "pick the insider"; whether the Daily has its own leaderboard.

## 9 · Anti-cheat

**Builds**
- `hit_rate_limit` Postgres function, applied per player to AI chat, room actions, room and solo creation, and Daily submits.
- Finishes faster than a case's minimum plausible time are saved unrated and logged as `cheat_flag`.
- Per-player daily AI budget; every AI call logs tokens and cost.

**Tests:** limits trip and reset correctly; a too-fast finish is unrated.

## 10 · Jobs and broadcasts

**Builds**
- `jobs` table and a cron route that claims due jobs safely and retries them.
- Scheduled: drain the queue (every minute), close and delete old rooms (hourly), recalculate median solve times (weekly), season rollover (admin-approved).
- Admin broadcast: a message to all players, sent through the queue at a rate Telegram allows. Streak reminders use the same path.

**Tests:** a job runs once even when two cron runs overlap; failed jobs retry with backoff.

## 11 · Launch

**Builds**
- App name, bot name and copy read from one brand config, switched to Rug City (or Chain Noir) at launch.
- New season starts with the new scoring.
- SQL views for the gate: day-1 and day-7 retention, case completion, AI cost per session, solo vs crew share.

**Needs from you:** secure the bot username and domain and check trademarks; write the launch announcement.

## What you need to do along the way

| When | What |
| --- | --- |
| Before slice 0 | Supabase plan and region |
| Slice 6 onward | Review and play drafted cases |
| Before slice 11 | Secure the name, launch announcement |
| Any time | Answer the open questions in each slice before it starts |

## Open questions, all in one place

- Rank thresholds, and whether help penalties also cut Clue Points or only the season rating.
- Solo: does Dex share all his clues at once or one at a time?
- Crew: does Dex vote?
- Tutorial: dedicated case, or the first normal case with tips?
- Daily: formats beyond "pick the insider", and a Daily leaderboard or not.
- Admin screen: inside the Mini App or a separate page?
