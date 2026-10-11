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
| 1 | In review | `phase1/01-data-model` | [#2](https://github.com/endritbabalija/Rug-City/pull/2) | Code, tests and local check done (memory store, `season_banner` on). `0004` applied and backfill run on the shared database (4 players; backup in `../Who-Rugged-backups/`). Not yet done: check a preview deploy with an old player; run the backfill again right after merging. Leftover: preview-only players have `doc = null`, which the code on `main` can't read |
| 2 | Not started | | | |
| 3 | Not started | | | |
| 4 | Not started | | | |
| 5 | Not started | | | |
| 6 | Not started | | | |
| 7 | Not started | | | |
| 8 | Not started | | | |
| 9 | Not started | | | |
| 10 | Not started | | | |
| 11 | Not started | | | |
