# 02 · Scoring v2

## Goal

The v2 rank ladder; every finished case is rated (solo and crew); help lowers the score instead of making a case unrated; time is scored against each case's own target.

## Read first

- `Game Design v2.md` → Decisions (help penalties, target time)
- `DEFAULTS.md` → ranks, penalties, time score, target time
- `lib/game/engine.ts` (`score`, `timeBonus`, `revealHint`, `trace`, `subpoena`, `finalize`)
- `lib/game/progress.ts` (`awardCase`, `RANKS`, `POINTS`, `UNRATED_REASON`)
- `lib/game/types.ts` (`RoomState`, `Award`, `Unrated`)
- `components/phases/Reveal.tsx`, `components/Profile.tsx`

## Build

1. **`lib/game/scoring.ts`** (pure): `HELP_PENALTY`, `HELP_PENALTY_CAP`, `PENALIZE_CLUE_POINTS`, `helpPenalty(help) → 0..cap`, `timeScore(elapsedSec, targetSec)`, `caseScore(correct, elapsedSec, targetSec, help)`. `score()` in `engine.ts` uses these; remove `timeBonus`'s fixed 10–25 minute window.
2. **Room state.** Add `mode: 'solo' | 'crew'` (existing rooms default to `crew`) and `help: { hint, trace, subpoena, dexHint }`, replacing `assisted`. `revealHint`, `trace`, `subpoena` increment `help`.
3. **Rating.** Remove the `'solo'` unrated reason and `RATED_MIN_SEATS`. Keep `replay`, `no-vote`, `daily-cap`. Every rated case writes `rating` = the player's own case score after penalty. Season rating stays the best `RATING_BEST_OF` of the season.
4. **Clue Points.** Same parts as today (`POINTS`); when `PENALIZE_CLUE_POINTS` is on, the case parts (culprit, motive, trail, speed) are cut by the penalty; crew and streak bonuses are not.
5. **Ranks.** `RANKS` = the ladder in `DEFAULTS.md`. Existing Clue Points stay.
6. **Migration `0005_case_stats.sql`:** `case_stats (case_id, mode, target_sec int, median_sec int null, min_sec int null, plays int default 0, updated_at, pk(case_id, mode))`. Store: `getCaseStats(caseId, mode)`, `bumpPlays(caseId, mode)`. `CaseFile` gets `targetSec` (set the three built-in cases from a playtest; start at 900). `targetFor(stats, caseFile)`: the median once `plays >= MEDIAN_AFTER_PLAYS`, else `targetSec`. `finalize` / settle use it.
7. **UI.** `Reveal.tsx`: show each penalty line ("Trace used −15%") and the final score; drop the "assisted, doesn't count" copy. `Profile.tsx`: new ladder. Points explainer updated.

## Reuse

- `countCorrect`, `plurality`, `finalize` in `engine.ts`; `rankFor` in `progress.ts`.

## Tests

- Penalties add up and stop at the cap.
- A clean solve always beats an aided solve with the same answers and time.
- `timeScore` at 0, at the target, between, at 2× and beyond.
- `targetFor` switches to the median at exactly 20 plays, per mode.
- Solo-sized and crew rooms are both rated; replays and the daily cap still aren't.
- Rank-up across the new thresholds.

## Done when

- A case finished on staging with a Trace shows the penalty on the verdict screen and still counts on the leaderboard.
- Done checks pass.

## Out of scope

- Too-fast checks (slice 9). Weekly median recalculation (slice 10). Solo rooms themselves (slice 3).
