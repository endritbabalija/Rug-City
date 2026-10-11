# Provisional defaults

Nothing in Game Design v2 is final. Every open decision below has a starting value so the slices can be built now. Each one lives in a single named constant, table or flag, so changing it later is a one-line change, not a rework.

To change one before its slice starts, edit this file. After the slice is merged, change the constant.

| Decision | Default | Lives in | Slice |
| --- | --- | --- | --- |
| Rank ladder | Rookie 0 · Inspector 500 · Chief 2,500 · Legend 10,000 Clue Points | `RANKS`, `lib/game/progress.ts` | 2 |
| District unlocks | Memecoin Swamp: Rookie. Sybil Square: Inspector. DeFi Docks: Chief. Districts 4–6: Legend. Sybil Square and DeFi Docks have one teaser (preview) case each that anyone can play while locked. Districts without cases stay off the map | `DISTRICTS` (`unlockRank`), `lib/districts.ts` | 5 |
| Help penalties | Hint 10%, Trace 15%, Subpoena 25%, Dex hint 10% of the case score. They add up, capped at 90%, and apply to every seat in the room | `HELP_PENALTY`, `HELP_PENALTY_CAP`, `lib/game/scoring.ts` | 2 |
| Penalties on Clue Points | Yes: the penalty cuts both the case's Clue Points and its rating score | `PENALIZE_CLUE_POINTS`, `lib/game/scoring.ts` | 2 |
| Time score | Full 20 points at or under the target time, sliding to 0 at 2× the target | `timeScore()`, `lib/game/scoring.ts` | 2 |
| Target time | The case's `targetSec` until it has 20 plays in that mode (solo or crew), then the weekly median | `case_stats` table, `MEDIAN_AFTER_PLAYS = 20` | 2 |
| Too-fast finish | Under 25% of the target, or under 120 s: saved unrated and flagged | `MIN_SOLVE_SHARE = 0.25`, `MIN_SOLVE_SEC = 120` | 9 |
| Dex sharing clues (solo) | One clue each time you ask, free | `lib/game/dex.ts` | 3 |
| Dex hints | 2 per case, free, each with the hint penalty. Shop Hints still work after that | `DEX_FREE_HINTS = 2` | 3 |
| Dex in the crew | Releases his clues to the group feed on a timer: 30 s, then one every 2 min. Doesn't vote | `DEX_RELEASE_SCHEDULE`, `lib/game/dex.ts` | 4 |
| Briefing grace | The host can start the investigation any time; after 3 min in the briefing, any member can | `BRIEFING_GRACE_MS`, `lib/game/types.ts` | 6b |
| Crew minimum with Dex | 2 humans + Dex | `MIN_HUMANS_WITH_DEX = 2`, `lib/game/types.ts` | 4 |
| Day-one cases | 3 free cases on the signup UTC day, then 1 free case a day | `DAY_ONE_FREE_CASES = 3`, `lib/player.ts` | 7 |
| Tutorial | A player's first case is `mooncat-exit` with Dex's tips on. No separate tutorial case | `TUTORIAL_CASE_ID`, `lib/game/dex.ts` | 7 |
| Daily | "Pick the insider" format only. 20 Clue Points if correct. Doesn't count toward Season Rating. No Daily leaderboard | `DAILY_POINTS = 20`, `lib/daily.ts` | 8 |
| Streak | A UTC day counts if you finish a rated case **or** the Daily | `touchStreak()`, `lib/game/progress.ts` | 8 |
| Rate limits | AI replies 30 per 10 min · room actions 60/min · new rooms or solo cases 10/hour · Daily submits 5/min | `LIMITS`, `lib/ratelimit.ts` | 9 |
| AI budget | 80 AI replies per player per UTC day, then scripted lines | `AI_DAILY_BUDGET = 80`, `lib/ratelimit.ts` | 9 |
| Seasons | S1 Oct 5–Nov 2, S2 Nov 2–30, S3 Nov 30–Dec 28 (2026), then 8 weeks each from S4 | `seasons` table seed | 1 |
| Admin screen | Inside the Mini App, only shown to `ADMIN_TELEGRAM_IDS` | `components/admin/*` | 6 |
| Cron runner | Vercel Cron if on Vercel Pro; otherwise Supabase `pg_cron` + `pg_net` calling the same routes | `vercel.json` or a migration | 10 |
| Environments | One Supabase project shared by previews and production until real players arrive; migrations only add; test data wiped at launch | `docs/ops/environments.md` | all |
| Brand | Rug City; "Who rugged?" stays as the hook line and the Daily's name | `lib/brand.ts` | 11 |

## Feature flags

All ship off. Turn on per environment in the `feature_flags` table, or with `FLAGS=a,b` locally.

| Flag | Slice | Turns on |
| --- | --- | --- |
| `season_banner` | 1 | Season countdown banner on Home |
| `solo` | 3 | Solo cases with Dex |
| `dex_crew` | 4 | Adding Dex to a crew lobby |
| `districts` | 5 | District map on Home |
| `tutorial` | 7 | Day-one free cases and Dex's tutorial tips |
| `daily` | 8 | Daily puzzle |
