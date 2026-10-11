# 09 · Anti-cheat

## Goal

Rate limits on every costly or farmable route, too-fast finishes caught, and a hard daily cap on AI cost per player.

## Read first

- `Game Design v2.md` → Guardrails
- `DEFAULTS.md` → Too-fast finish, Rate limits, AI budget
- `lib/server.ts` (`route`, `errorResponse`), `lib/game/engine.ts` (`GameError`)
- `lib/game/progress.ts` (`awardCase`, `UNRATED_REASON`), `lib/ai/suspect.ts`, `lib/ai/dex.ts`
- API routes under `app/api/rooms/`, `app/api/solo/`, `app/api/daily/`

## Build

1. **Migration `0008_rate_limits.sql`.** `rate_limits (key text, window_start timestamptz, count int, pk(key, window_start))` and a SQL function `hit_rate_limit(p_key text, p_limit int, p_window_sec int) returns boolean` (insert … on conflict do update set count = count + 1 returning count). Store method `hitRateLimit(key, limit, windowSec)`; memory store version.
2. **`lib/ratelimit.ts`.** `LIMITS` (from `DEFAULTS.md`), `limit(playerId, bucket)` throws `GameError('RATE_LIMITED', 'Slow down, detective. Try again in a minute.', 429)`. Apply: `ai` on suspect chat and `askDex`; `action` on room actions; `create` on hosting and solo; `daily` on Daily submit.
3. **AI budget.** Bucket `ai_day` with `AI_DAILY_BUDGET` per UTC day. When it's exceeded, suspects and Dex answer with their scripted fallback instead of an error.
4. **Too-fast finishes.** New `Unrated` reason `'too-fast'`: elapsed below `max(MIN_SOLVE_SEC, MIN_SOLVE_SHARE × target)` (or `case_stats.min_sec` once set). The result is saved unrated; event `cheat_flag` with case, mode, elapsed and target.
5. **AI cost.** `ai_call` events get `costUsd` from per-model price constants in `lib/ai/pricing.ts`.

## Tests

- Each bucket trips at its limit and resets in the next window.
- A finish under the minimum is unrated and records `cheat_flag`.
- Past the AI budget, replies are scripted and no model call is made (mock the SDK).
- Rate-limited routes return 429 with the error shape from `errorResponse`.

## Done when

- On a preview deploy, hammering suspect chat returns 429, and a scripted fast finish is unrated.
- Done checks pass.

## Out of scope

- Redis (only if Postgres limits get hot). Bot or multi-account detection.
