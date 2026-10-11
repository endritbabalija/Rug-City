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
6. **Home: next case first, districts as a progress map** (behind flag `districts`; slice 5's map is too hard to read, since a new player has to work out districts before they can start a case):
   - **Next case** card at the top of Home: the newest unplayed case in the player's open districts, with Play solo and Host buttons right on it. A player with no results sees `TUTORIAL_CASE_ID` here marked "Start here" (item 2). Under it, "More <district> cases (N new) ›" opens the district screen.
   - **All caught up:** when every open case is played, the card says "All caught up. Next case drops on <date>" (slice 5's `nextDrop`, date only) and points to the teasers.
   - **Rug City** below it, with one line: "Rank up to open the next district." Each open district shows "✓ open · N new ›". Each locked one shows its rank, a progress bar of the player's Clue Points towards that rank (e.g. 120 / 500 CP), and "1 teaser case, free to play ›" when it has one.
   - District screens, NEW/CLOSED stamps, and Host / Solo stay as they are.

## Tests

- New player: 3 free cases on day one, 1 the next day; old player: unchanged.
- Day boundaries at UTC midnight.
- Tutorial only offered to players with no results.
- Next case: picks the newest unplayed case in an open district, the tutorial case for a player with no results, and nothing when everything is played. The progress towards each locked district's rank is right at 0, mid-way and at the threshold.

## Done when

- A fresh test account sees "Start here" on the Next case card, gets tips through its first case, and has 2 free cases left that day.
- With `districts` on, Home shows the Next case card above the Rug City map, with progress bars on the locked districts.
- Done checks pass.

## Out of scope

- A dedicated tutorial case.
