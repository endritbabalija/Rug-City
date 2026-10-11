# 06 · Case pipeline and admin review

## Goal

AI drafts new Memecoin Swamp cases in the `CaseFile` format, a blind solver rejects unfair ones, and Endrit reviews, playtests and releases them from an admin screen in the app. Target: 12 Memecoin Swamp cases for launch.

## Read first

- `Who Rugged — Concept.md` → How cases are made
- `Game Design v2.md` → Decisions (12 cases, pipeline)
- `lib/cases/schema.ts`, the three built-in cases, `tests/cases.test.ts` (`culpritProofs`, deal checks)
- `lib/ai/suspect.ts` (Anthropic client setup), `lib/env.ts`
- `app/api/telegram/webhook/route.ts` (admin check pattern)
- Run `/claude-api` (skill) before writing model calls, for current model ids and structured output

## Build

1. **Scripts.** Add `tsx` as a dev dependency. `scripts/cases/draft.ts` (`npm run cases:draft -- --district memecoin-swamp --count 4`) and `scripts/cases/check.ts` (`npm run cases:check -- <id>`). They reuse `lib/` code (schema, deal functions) and write to the database with the service key.
2. **Draft.** Model from `CASE_MODEL` (default: the most capable current Claude model). The prompt gives the district, a crime type, the content rules from `CONVENTIONS.md` and the three built-in cases as examples. Output must validate against the schema; retry with the validation errors up to 3 times.
3. **Check** (both must pass):
   - **Static:** the checks in `tests/cases.test.ts` (answer ids exist, every clue dealt, no single seat holds a `culpritProofs` set for 3–6 seats).
   - **Blind solver:** a separate model call gets public case data, the explorer and one or more clue hands, and must answer culprit, motive and trail. With all clues it must get all three right. With any single hand at 3+ seats it must not name the culprit with confidence. Run each check twice.
   - Suggest `targetSec` = 60 s × clues + 90 s × suspects (rounded); Endrit adjusts it in review.
4. **Insert** passing cases as `status: 'review'` with the solver report in `data.review`.
5. **Admin API** `app/api/admin/cases/route.ts` and `[id]/route.ts`: list by status, get, approve (`release_at`, `targetSec`), reject. Checked against `env().adminIds`; 403 otherwise.
6. **Admin screen** `components/admin/CaseReview.tsx`, a new `Screen` only shown to admins (`/api/me` returns `isAdmin`): list, read the full case, the solver report, and "Playtest" which starts a solo room that is free and unrated (`playtest: true` on the room).
7. **Content.** Draft and check 12 Memecoin Swamp cases; leave them in `review` for Endrit.

## Tests

- The three built-ins pass the static checks and the schema (the solver isn't run in CI).
- Admin routes return 403 for non-admins.
- Playtest rooms charge nothing and write no rated result.

## Done when

- 12 drafted cases are in `review` in the database, each with a solver report.
- An admin can playtest and approve a case, and it appears in Memecoin Swamp at its release time.
- Done checks pass.

## Out of scope

- Daily puzzle drafting (slice 8 reuses this). Player-made cases (Phase 4).

## Needs from Endrit

- Review and playtest the drafted cases; set target times.
