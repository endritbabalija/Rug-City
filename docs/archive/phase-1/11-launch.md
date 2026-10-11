# 11 · Launch

## Goal

Rename to Rug City, start the new season with everything switched on, and have the gate numbers ready to read.

## Read first

- `Game Design v2.md` → Name, Roadmap (Phase 1 gate), Decisions (rename)
- `docs/phase-1/DEFAULTS.md` → Feature flags
- Files with the old name: `app/layout.tsx`, `app/api/telegram/webhook/route.ts`, `app/api/verdict/[code]/route.tsx`, `components/phases/Reveal.tsx`, `lib/ai/suspect.ts`, `lib/server.ts`, `scripts/setup-bot.mjs`, `README.md`

## Build

1. **`lib/brand.ts`.** `BRAND = { name: 'Rug City', hook: 'Who rugged?' }` (Chain Noir is the fallback). Replace every user-facing "Who Rugged" with it. Internal keys stay as they are (`__whoRuggedStore`, the dev-user `sessionStorage` key, the package name).
2. **Migration `0010_gate_views.sql`.** Views:
   - `v_retention`: players by first `app_open` day, share with any `app_open` on day 1 and on day 7.
   - `v_payers`: share of active players with a `purchase`, by week.
   - `v_case_completion`: `case_start` vs `case_finish`, by mode.
   - `v_ai_cost_per_session`: sum of `ai_call.costUsd` per finished case.
   - `v_mode_share`: solo vs crew finishes.
   - `v_invites`: `invite_sent` per week, and how many `invite_joined` follow.
3. **`docs/ops/launch.md`.** Checklist: secure name → `npm run bot:setup` with the new bot, and recreate the `preview` Mini App on it (`docs/ops/environments.md` → Preview) → env vars → apply migrations → backfill done → back up, then wipe test data from the shared database (players, rooms, chats, results, ratings, events; keep `cases`, `daily_puzzles`, `seasons`, `feature_flags`; refund or keep real Stars purchases first) → turn on flags `solo`, `dex_crew`, `districts`, `tutorial`, `daily` → check the new season row → `/broadcast` the launch message → watch Sentry and `v_retention`.
4. **README.** Rename, update the run and deploy sections.

## Tests

- No user-facing string contains "Who Rugged" outside `BRAND.hook` (grep test).
- The views run on the database with sample events.

## Done when

- A preview deploy runs fully as Rug City with all flags on.
- Done checks pass.

## Needs from Endrit

- Secure the bot username and domain, check trademarks; write the launch announcement.
