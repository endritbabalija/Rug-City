# Phase 1 build briefs

Oct 11, 2026 · @endrit

Phase 1 of `Game Design v2.md`, split into 12 slices that a coding agent can build one per session. Each brief is self-contained. Background: `Game Design v2.md` (what), `Architecture.md` (how), `Phase 1 Plan.md` (why this order).

## Files

| File | What it is |
| --- | --- |
| `CONVENTIONS.md` | Rules every agent follows in this repo |
| `DEFAULTS.md` | Every provisional decision, its value, and the constant or flag it lives in |
| `00-foundation.md` … `11-launch.md` | One brief per slice |

## Order

Run the slices in order. Slices 8 (Daily) and 9 (Anti-cheat) can run in parallel worktrees once their dependencies are merged.

| # | Slice | Needs | Size |
| --- | --- | --- | --- |
| 0 | [Foundation](00-foundation.md) | — | M |
| 1 | [Data model](01-data-model.md) | 0 | L |
| 2 | [Scoring v2](02-scoring-v2.md) | 1 | M |
| 3 | [Solo with Dex](03-solo-dex.md) | 2 | L |
| 4 | [Dex in the crew](04-dex-crew.md) | 3 | S |
| 5 | [Districts and cases in Postgres](05-districts.md) | 1 | M |
| 6 | [Case pipeline and admin review](06-case-pipeline.md) | 5 | L |
| 7 | [First day and tutorial](07-first-day.md) | 3, 5 | S |
| 8 | [Daily](08-daily.md) | 2 | M |
| 9 | [Anti-cheat](09-anti-cheat.md) | 3 | M |
| 10 | [Jobs, cron and broadcasts](10-jobs.md) | 2 | M |
| 11 | [Launch](11-launch.md) | all | S |

## Kickoff prompt

Paste this into a fresh session, replacing `NN-<slice>`:

> Read `AGENTS.md`, `docs/phase-1/README.md`, `docs/phase-1/CONVENTIONS.md`, `docs/phase-1/DEFAULTS.md` and `docs/phase-1/NN-<slice>.md`. Implement slice NN exactly as the brief says, on a new branch `phase1/NN-<slice>`. Ask me before going beyond "Out of scope". Finish by running the done checks and updating the status table in `docs/phase-1/README.md`.

To change a decision, edit `DEFAULTS.md` (and the brief if needed) before the slice starts. After a slice is merged, change the constant or flag in code.

## Status

Agents update this table at the end of each session.

| # | Status | Branch | PR | Notes |
| --- | --- | --- | --- | --- |
| 0 | Done | `phase1/00-foundation` | [#1](https://github.com/endritbabalija/Rug-City/pull/1) | `0003` applied; Supabase vars on Preview; production writes `app_open`; a test error reached Sentry. Known issue: `who-rugged-blond.vercel.app` is unreachable from some networks (Endrit's home Wi-Fi); a custom domain fixes it, before launch |
| 1 | Done | `phase1/01-data-model` | [#2](https://github.com/endritbabalija/Rug-City/pull/2) | `0004` applied; backfill run before and after merging (4 players, nothing lost; backup in `../Who-Rugged-backups/`). No test bot, so checked locally against the shared database: an old player loads from the new columns; a full case wrote `case_results`, `room_chats`, points and season ratings; a replay stayed unrated. `players.doc` is no longer read; drop it in a later migration after one release |
| 2 | Done | `phase1/02-scoring-v2` | [#3](https://github.com/endritbabalija/Rug-City/pull/3) | Live in production. `0005` applied before the merge (`case_stats`, `bump_case_plays` service-role only). Typecheck, lint, 139 tests, build pass. No test bot, and `npm run dev` uses the memory store on purpose, so checked locally there: a 3-seat Trace case scored 102 (−15%), paid 76 Clue Points and ranked all three seats. The verdict screen showed "Before help 120 · Trace used −15% · Final score 102" and the cut Clue Points in Chrome. Targets start at 900 s for all three cases until playtest timings. `case_stats.target_sec` / `min_sec` stay null; targets come from `CaseFile.targetSec` |
| 3 | Done | `phase1/03-solo-dex` | [#4](https://github.com/endritbabalija/Rug-City/pull/4) | Merged; `solo` flag on in the shared `feature_flags` table, so solo is live in production. No migration (Dex's state is in the room doc). Typecheck, lint, 161 tests, build pass. No test bot and deployed builds only accept Telegram logins, so checked locally through the dev API with `FLAGS=solo`: a solo MoonCat case opened on the briefing, Dex shared a clue and a hint, and the verdict was rated (108 after the −10% Dex hint, 79 Clue Points) and listed under recent cases. Still to check: a solo case in Telegram in production. `ANTHROPIC_API_KEY` is on Preview only, so Dex (and suspects) use scripted lines in production until it's added after slice 9's AI limits. `GET /api/rooms/[code]` uses `authenticateId` (no player load) |
| 4 | Built, preview check pending | `phase1/04-dex-crew` | | Not committed yet. No migration (`dexSeated` lives in the room doc). Typecheck, lint, 181 tests and build pass. Checked in tests through `lib/rooms.ts`, not in Telegram: 2 players + Dex played a MoonCat case to the verdict, rated as `crew` with 2 seats; Dex's notes went public on the timer for both players, and one player's Dex hint applied the −10% to everyone. Crew releases aren't stored: `buildView` works them out from `investigateStartedAt` and adds a feed line for each, and the client refetches when the next one is due. Dex's line is capped at `max_tokens` 800 (thinking counts toward it) and falls back to a scripted line if it hits the cap. Still to do: on the preview, two accounts plus Dex finish a case and Dex's lines stay under about 40 words. `dex_crew` is in the shared `feature_flags` table, so switching it on for the preview also switches it on in production |
| 5 | Not started | | | |
| 6 | Not started | | | |
| 7 | Not started | | | |
| 8 | Not started | | | |
| 9 | Not started | | | |
| 10 | Not started | | | |
| 11 | Not started | | | |
