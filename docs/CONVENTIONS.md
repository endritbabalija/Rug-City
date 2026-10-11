# Conventions

Rules every agent follows when writing code here. When a brief and this file disagree, ask.

## Code

1. **Next.js 16.4 is not the Next.js you know.** Before using a Next API, read its guide in `node_modules/next/dist/docs/` (see `AGENTS.md`). Useful pages:
   - `after`: `01-app/03-api-reference/04-functions/after.md`
   - Route handlers: `01-app/03-api-reference/03-file-conventions/route.md`
   - `maxDuration`: `01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`
   - Upgrade notes: `01-app/02-guides/upgrading/version-16.md`
   - Known differences: `params` is a Promise, there is no `next lint`, `middleware` is now `proxy`, runtime config is gone (read `process.env`).
2. **Rules stay pure.** Game rules are pure functions that take state and return new state or throw `AppError` (`lib/errors.ts`). Routes and services only load, call the rules, and save.
3. **Store parity.** All data access goes through the `Store` interface in `lib/store/types.ts`, implemented in **both** `lib/store/memory.ts` and `lib/store/supabase.ts`. Tests and local dev run on the memory store.
4. **Server decides.** Hidden case data (answers, undiscovered evidence, future dialogue) never reaches the client. Every response goes through a projection that returns only what this player has unlocked.
5. **Idempotent writes.** Unlocks, completions and jobs must be safe to run twice: unique keys and versioned writes (`updatePlayer` in `lib/store/supabase.ts` shows the compare-and-swap).
6. **Provisional values** live in one named constant, never a literal in the code.
7. **Match the surrounding code:** naming, comment density, small files, zod for request bodies, `route()` and `authenticate()` from `lib/server.ts` for every API route.

## Data

8. **Migrations** go in `supabase/migrations/000N_<name>.sql`, numbered in order, never edited after merge. RLS on with no policies (only the server, with the secret key, can read or write). **Migrations only add** while previews and production share one database: never drop, rename or change the meaning of anything the code on `main` still uses; removals ship later as their own migration (`docs/ops/environments.md`).
9. **Feature flags.** New player-facing features check `flag('<name>')` (`lib/flags.ts`) and ship switched off.
10. **Events.** Call `track()` (`lib/analytics.ts`) for every event a brief lists. It never throws and never blocks the response.

## Content

11. Everything is fictional parody: no real people, projects, exchanges or wallet addresses. Cases show how scams are caught, never how to run one.

## Tests

12. Follow `tests/auth.test.ts`: delete `NEXT_PUBLIC_SUPABASE_URL` before importing so the memory store is used, call route handlers or services directly, and reset the store between tests. Set env vars inside try/finally (`env()` re-reads `process.env` each call).
13. Pure rules get unit tests. Checks that apply to case content (every record reachable, every finding supported) run over every authored case.

## Done checks

14. `npm run typecheck && npm run lint && npm test && npm run build` all pass.
15. The feature works on the branch's preview deploy inside Telegram, with its flag switched on: `npm run preview:point -- <branch>`, then open `t.me/WhoRuggedBot/preview` (`docs/ops/environments.md` → Preview). Do this before merging.
16. New env vars are in `.env.example`; `README.md` is updated when setup changes.

## Git

17. One branch per task, one PR into `main`. Commit only when asked. Never skip hooks.
