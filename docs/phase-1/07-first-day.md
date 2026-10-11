# 07 · First day and tutorial

## Goal

New players get 3 free cases on their first day, and their first case doubles as the tutorial, with Dex explaining each step once.

## Read first

- `Game Design v2.md` → Decisions (free play)
- `DEFAULTS.md` → Day-one cases, Tutorial
- `lib/player.ts` (`newPlayer`, `hasFreeCase`, `consumeCase`), `lib/server.ts` (`publicPlayer`)
- Slice 3's Dex panel and `lib/game/dex.ts`
- `components/Home.tsx`, `components/phases/*`

## Build

1. **Free cases.** New column `day_one_used int default 0`. `consumeCase`: on the player's signup UTC day (`createdAt`), use a day-one case while `day_one_used < DAY_ONE_FREE_CASES`; otherwise the daily free case, then credits. Players created before this slice keep today's rule. `publicPlayer` returns `freeCasesToday`.
2. **Tutorial.** A player with no `case_results` gets `TUTORIAL_CASE_ID` highlighted as "Start here" and, when they open it, a solo room with `tutorial: true`.
3. **Tips.** In tutorial rooms, Dex shows one scripted tip at each step (briefing, first clue, explorer, suspect chat, vote) in the Dex panel. Tips are static text in `lib/game/dex.ts`, no AI call.
4. **Events:** `tutorial_step` (`step`), `tutorial_done`.
5. Everything behind flag `tutorial`.

## Tests

- New player: 3 free cases on day one, 1 the next day; old player: unchanged.
- Day boundaries at UTC midnight.
- Tutorial only offered to players with no results.

## Done when

- A fresh staging account sees "Start here", gets tips through its first case, and has 2 free cases left that day.
- Done checks pass.

## Out of scope

- A dedicated tutorial case.
