# 08 · Daily

## Goal

"Who rugged?" daily: one short puzzle a day, the same for everyone, with a streak and a spoiler-free share text.

## Read first

- `Game Design v2.md` → Modes (Daily), Social and growth (share cards)
- `DEFAULTS.md` → Daily, Streak
- `lib/game/progress.ts` (streak logic in `awardCase`, `currentStreak`)
- `lib/telegram/webapp.ts` (`shareStory`, `shareToChat`), `components/phases/Reveal.tsx` (how sharing is used)
- Slice 6's pipeline scripts and admin screen

## Build

1. **Migration `0007_daily.sql`.** `daily_puzzles (day date pk, status text, data jsonb)`; `daily_results (day, player_id, choice, correct bool, opened_at, solved_at, pk(day, player_id))`.
2. **`lib/daily.ts`** (pure): zod schema (`title`, `setup`, up to 5 `txs` and `wallets` in the explorer format, `options`, `answer`, `explanation`), `grade(puzzle, choice)`, `shareText(result, streak)` such as `Who rugged? #12 ✅ 1:42 🔥5`. `DAILY_POINTS`.
3. **Streak.** Extract `touchStreak(player, now)` from `awardCase` into `lib/game/progress.ts`; both case awards and the Daily use it.
4. **Routes.** `GET /api/daily`: today's puzzle without `answer`/`explanation`, records `opened_at` once, returns my result if any (with the explanation once solved). `POST /api/daily { choice }`: one submission per player per day (the primary key enforces it), gives `DAILY_POINTS` if correct, touches the streak, records `daily_finish`.
5. **Content.** `npm run cases:daily -- --count 14` drafts puzzles into `review` (reuse slice 6); the admin screen gets a Daily tab to approve them for a date. No puzzle today → the card says so.
6. **UI** behind flag `daily`: a Daily card at the top of Home, the puzzle screen, a result screen with the explanation, and share to chat or story.

## Tests

- One submission per day; a second is rejected.
- UTC day boundaries for which puzzle is "today".
- `shareText` never contains the answer, option text or puzzle title for any sample.
- A Daily and a case on the same day count as one streak day; a Daily alone keeps the streak.
- `GET` never returns `answer` before submitting.

## Done when

- On staging, an approved puzzle plays, scores, extends the streak and shares.
- Done checks pass.

## Out of scope

- Other puzzle formats. A Daily leaderboard.
