# 03 · Solo with Dex

## Goal

A player can play any open case alone with Detective Dex as partner. This slice also fixes room syncing so solo and crew rooms stop polling every 4 seconds.

## Read first

- `Game Design v2.md` → Your AI partner, Decisions (Dex)
- `DEFAULTS.md` → Dex rows
- `lib/game/engine.ts` (`dealClues`, `dealSuspects`, `cluesFor`, `start`, `castVote`), `lib/game/view.ts`
- `lib/rooms.ts` (`createRoom`, `act`, `chargedStep`, `ask`), `lib/player.ts` (`consumeCase`)
- `lib/ai/suspect.ts` (prompt caching, fallback), `hooks/useRoom.ts`, `lib/server.ts` (`authenticate`)
- `components/Home.tsx`, `components/Room.tsx`, `components/phases/Investigate.tsx`

## Build

1. **AI seat.** `DEX_ID = 0` in `lib/game/types.ts` (Telegram ids are positive, so it can't collide). Dex sits in `seats` and gets clues and suspects from the existing deal functions. He is never in `players`, so `castVote`'s "everyone voted" check stays humans-only.
2. **Solo room.** `POST /api/solo { caseId }` → `rooms.createSolo(player, caseId)`: charges a case with `consumeCase` (refund on failure like `chargedStep`), creates a room with `mode: 'solo'`, seats `[player.id, DEX_ID]`, phase `briefing`. Respects district unlocks once slice 5 exists.
3. **`lib/game/dex.ts`** (pure): `dexHand(state, c)`, `shareNextClue(state, c)` (adds to room `dexShared: string[]`, free), `dexHint(state, c)` (reveals the next hint, increments `help.dexHint`, up to `DEX_FREE_HINTS`). New room action `{ type: 'askDex', ask: 'clue' | 'hint' }` in `lib/rooms.ts`.
4. **`lib/ai/dex.ts`.** Dex's voice for banter around each shared clue and hint, using the suspect model. **Dex never sees the answer, `truth`, `lies` or `reveal`**: his prompt holds only the public case, his own clues and revealed hints. Scripted fallback lines like `fallbackReply`. He may mention the player's last case (`recentResults`). Logs `ai_call`. Keep replies short; prompt cached per case.
5. **View.** `buildView` adds `dex: { shared: Clue[], messages, hintsLeft } | null`. Everything Dex shared is visible to the player.
6. **Sync fix** in `hooks/useRoom.ts`: solo rooms don't poll or subscribe (every action response already returns the fresh view). Crew rooms poll every 30 s while the Realtime channel is `SUBSCRIBED`, every 4 s otherwise. `GET /api/rooms/[code]` uses a light auth path that validates init data and takes the user id without loading or updating the player (`authenticateId` in `lib/server.ts`).
7. **UI** behind flag `solo`: "Play solo with Dex" on each case in `Home.tsx`; solo rooms skip `Lobby`; a Dex panel in `Investigate.tsx` with "What have you got?" (clue) and "Give me a hint" (shows the penalty before confirming).
8. **Events:** `case_start` gets `mode`; new `dex_ask` with `ask`.

## Reuse

- `chargedStep`, `consumeCase`, `refundQuestion`'s pattern, `suspectReply`'s caching and fallback, `ClueCard`, `SuspectCard`.

## Tests

- Solo flow from create to verdict: rated as `solo`, charged one case, refunded if creation fails.
- Dex's hand plus the player's hand cover every clue for every case.
- The built Dex prompt contains no suspect `truth`, `lies`, `answer` or `reveal` text (assert on the string, for every case).
- Dex hints stop at `DEX_FREE_HINTS` and apply the penalty.
- A crew room with Realtime connected doesn't poll faster than 30 s (unit test the interval choice).

## Done when

- On a preview deploy inside Telegram, a solo case plays end to end with Dex and shows up on the profile as rated.
- Done checks pass.

## Out of scope

- Dex in crew rooms (slice 4). Tutorial tips (slice 7). Rate limits (slice 9).
