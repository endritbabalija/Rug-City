# 01 · Data model

## Goal

Move player progress out of the `players.doc` JSON into typed tables, move suspect chats out of the room document, and replace fixed-length seasons with a `seasons` table. Players should see no change except the season dates.

## Read first

- `Architecture.md` → decision B
- `lib/player.ts` (`Player`, `RecentCase`, `consumeCase`, `applyGrant`)
- `lib/game/progress.ts` (`awardCase`, `seasonOf`, `seasonBounds`, `progressSummary`)
- `lib/rooms.ts` (`ask`, `settleAfter`, `settleSeat`), `lib/season.ts`
- `lib/game/engine.ts` (`askSuspect`, `suspectReply`, `refundQuestion`), `lib/game/view.ts` (`buildView`)
- `lib/store/*`, `supabase/migrations/0001_init.sql`, `0002_progress.sql`
- `tests/flow.test.ts`, `tests/progress.test.ts`

## Build

1. **Migration `0004_player_tables.sql`.**
   - `players`: add typed columns `name`, `username`, `photo_url`, `case_credits`, `subpoena`, `trace`, `hint`, `free_case_day`, `referred_by`, `referral_settled`, `active_badge`, `clue_points`, `streak_days`, `last_rated_day`, `rated_day`, `rated_count`. Make `doc` nullable. `version` stays for compare-and-swap.
   - `player_badges (player_id, badge, at, pk(player_id, badge))`.
   - `season_rewards (season, player_id, at, pk(season, player_id))`.
   - `case_results (id bigserial, room_code, player_id, case_id, mode text, seats int, correct int, score int, points jsonb, total int, rating int null, elapsed_sec int, unrated text null, at timestamptz)`; unique `(room_code, player_id)`; indexes `(player_id, case_id)` and `(player_id, at desc)`; index `(case_id, mode)` for medians later.
   - `seasons (id int pk, starts_at timestamptz, ends_at timestamptz)`, seeded with the dates in `DEFAULTS.md`.
   - `room_chats (room_code, player_id, suspect_id, seq int, sender text, text, subpoena bool, at, pk(room_code, player_id, suspect_id, seq))`.
2. **Player type.** `Player` in `lib/player.ts` keeps the counters and inventory. Remove `playedCases`, `recent`, `season`, `badges`, `seasonRewards` from it; they come from the store:
   - `hasPlayed(playerId, caseId)`, `recentResults(playerId, limit)`, `seasonScores(playerId, season)` from `case_results`
   - `getBadges(playerId)`, `addBadge`, `removeBadge`
   - `hasSeasonReward(season, playerId)`, `addSeasonReward`
   - `insertCaseResult(row)` returning `false` if `(room_code, player_id)` already exists
   - `getChats(code, playerId)`, `appendChat(row)`, `deleteLastChat(...)`
   - `getSeasons()`
   Keep `updatePlayer(id, fn)` as compare-and-swap on the row's `version`, mapping columns ↔ `Player`.
3. **Awarding.** `awardCase` stays pure. New input `{ alreadyPlayed: boolean, seasonScores: number[] }`; output `{ player, award, result: CaseResultRow }`. `settleSeat` loads the inputs, calls `insertCaseResult` first (a second settle finds the row and stops), then updates the player counters, then the leaderboard as today.
4. **Seasons.** Replace `SEASON_EPOCH`, `SEASON_MS`, `seasonOf`, `seasonBounds` with pure `seasonAt(now, seasons)` and `seasonById(id, seasons)` in `lib/game/progress.ts`. `lib/seasons.ts` loads `getSeasons()` with a 5-minute cache. `progressSummary` takes the seasons list; `/api/me` still returns season id and end. Update `lib/season.ts` (`leaderboard`, `grantSeasonRewards`) to use it.
5. **Chats.** The room keeps `questionsUsed` and `subpoenas` and gains `awaiting: Record<chatKey, true>`, which replaces the "last message is from the player" check in `askSuspect`. `askSuspect` / `suspectReply` / `refundQuestion` in `engine.ts` update `awaiting` and counters only; `ask` in `lib/rooms.ts` writes and deletes `room_chats` rows. `buildView` takes the player's chats as an argument.
6. **Badges and rewards.** `applyGrant` returns the badge to add or remove instead of editing an array; payments, refunds and season rewards call the store.
7. **Season banner.** On Home, behind flag `season_banner`: "Season N ends in X days".
8. **Backfill `scripts/backfill-v2.mjs`.** Reads every `players.doc` and fills the new columns, `player_badges`, `season_rewards`, and `case_results` rows rebuilt from `recent` (use room code `legacy-<caseId>` and mark them so they can't collide). Idempotent; prints a summary. Take a backup first. Because previews and production share one database (`docs/ops/environments.md`), production keeps reading `doc` while the branch is tested: run the backfill once to test, and again right after merging. `doc` is dropped by a later migration after one release.

## Reuse

- `casDoc` in `lib/store/supabase.ts` → becomes a row-level compare-and-swap on `version`.
- `withRetries`, `CONFLICT`, `ConflictError` in `lib/store/types.ts`.
- The claim pattern in `settleAfter`.

## Tests

- All existing tests pass (update imports and fixtures, not assertions about behaviour).
- Settling the same room twice writes one `case_results` row and pays once.
- Replays stay unrated (via `hasPlayed`).
- `seasonAt` at season boundaries, including the 4-week → 8-week switch.
- Backfill: sample old docs (with badges, recent, season scores) → expected rows.
- A suspect question that fails is refunded and its chat row removed.

## Done when

- A preview deploy runs on the new tables after the backfill, and an old player's points, badges and recent cases look the same.
- Done checks pass.

## Out of scope

- Any scoring change (slice 2). Dropping `doc` (later migration).

## Needs from Endrit

- OK to run the backfill (after a backup) on the shared database.
