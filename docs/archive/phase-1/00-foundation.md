# 00 · Foundation

## Goal

CI, staging, error tracking, product events and feature flags, so every later slice can be shipped safely and measured. No player-facing change.

## Read first

- `Architecture.md` → decisions F (analytics) and G (dev process)
- `package.json`, `vitest.config.mts`, `next.config.ts`
- `lib/store/types.ts`, `lib/store/index.ts`, `lib/store/memory.ts`, `lib/store/supabase.ts`
- `lib/server.ts` (`authenticate`, `route`), `lib/rooms.ts` (`act`, `settleSeat`), `lib/payments.ts` (`handleSuccessfulPayment`), `lib/ai/suspect.ts` (`suspectReply`)
- Next docs: `after.md`, and the ESLint guide `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`

## Build

1. **Lint.** ESLint 9 flat config with `eslint-config-next`; `"lint"` script in `package.json`. Fix or explicitly disable whatever it flags in existing code (keep fixes minimal).
2. **CI.** `.github/workflows/ci.yml`, on push and pull request: Node 22, `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. No secrets needed (the build falls back to the memory store).
3. **Migration `supabase/migrations/0003_events_flags.sql`.**
   - `events (id bigserial pk, name text not null, player_id bigint null, props jsonb not null default '{}', at timestamptz not null default now())`, indexes on `(name, at)` and `(player_id, at)`.
   - `feature_flags (name text pk, enabled boolean not null default false, note text, updated_at timestamptz)`.
   - RLS on, no policies.
4. **Store.** Add `trackEvents(events: AppEvent[]): Promise<void>` and `getFlags(): Promise<Record<string, boolean>>` to `Store`, in both stores.
5. **`lib/analytics.ts`.** `track(name, playerId | null, props?)`: queues the write with `after()` from `next/server` so it never delays the response; catches and logs every error. Outside a request (tests, scripts) it writes directly. Event names are a string union `EventName` in the same file.
6. **`lib/flags.ts`.** `flag(name): Promise<boolean>`, reading `getFlags()` with a 30 s in-memory cache. `FLAGS=a,b` in env forces those flags on (local and tests). Flag names are a string union.
7. **First events.**

   | Event | Where | Props |
   | --- | --- | --- |
   | `app_open` | `GET /api/me` (`app/api/me/route.ts`) | `startParam` |
   | `case_start` | `act` → `'start'` in `lib/rooms.ts` | `caseId`, `seats`, `code` |
   | `case_finish` | `settleSeat` in `lib/rooms.ts` | `caseId`, `code`, `correct`, `total`, `unrated` |
   | `purchase` | `handleSuccessfulPayment` in `lib/payments.ts` | `sku`, `stars` |
   | `invite_joined` | new player with `referredBy` in `authenticate` (`lib/server.ts`) | `referrer` |
   | `ai_call` | `suspectReply` in `lib/ai/suspect.ts` | `model`, `inputTokens`, `outputTokens`, `cacheRead`, `fallback` |

   `suspectReply` doesn't know the player id today; pass it in.
8. **Sentry.** `@sentry/nextjs` on client and server, following its current Next.js guide. Does nothing when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are unset. Tag errors with player id and room code where `route()` in `lib/server.ts` catches them.
9. **Test helper.** Export `resetStore()` from `lib/store/index.ts` (clears `globalThis.__whoRuggedStore`), for tests only.
10. **`docs/ops/environments.md`.** Local (memory store, `DEV_AUTH=1`), staging (second Supabase project, staging bot, Vercel Preview env vars, how to apply migrations, how to set flags), production. Include the region note: Vercel function region = Supabase region.
11. **`.env.example`:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `FLAGS`.

## Reuse

- `withRetries` / `CONFLICT` in `lib/store/types.ts` (not needed for inserts, but keep error handling consistent with `check()` in `lib/store/supabase.ts`).
- `env()` in `lib/env.ts` for new env vars.

## Tests

- `tests/analytics.test.ts`: `track` writes to the memory store; a failing store doesn't throw.
- `tests/flags.test.ts`: cache, `FLAGS` override, unknown flag is `false`.
- Flow test: a finished case records `case_start` and `case_finish`.
- All existing tests still pass.

## Done when

- CI is green on the PR.
- On a preview deploy, opening the app writes an `app_open` row and a test error shows up in Sentry.
- Done checks in `CONVENTIONS.md` pass.

## Out of scope

- Dashboards and gate views (slice 11).
- Any change to rules or UI.

## Needs from Endrit

- Staging bot in BotFather, staging Supabase project, Sentry project.
- Supabase plan and region; set the Vercel function region to match.
