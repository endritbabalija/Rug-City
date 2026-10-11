# 04 · Dex in the crew

## Goal

Two friends plus Dex can play a crew case. Dex fills one seat, shares his clues with the group and never votes.

## Read first

- `DEFAULTS.md` → Dex in the crew, crew minimum
- Slice 3's `lib/game/dex.ts` and `DEX_ID`
- `lib/game/engine.ts` (`start`, `join`, `leave`), `lib/rooms.ts` (`minPlayersFor`), `lib/game/view.ts`
- `components/phases/Lobby.tsx`, `components/phases/Investigate.tsx`

## Build

1. **Lobby actions** `addDex` / `removeDex`, host only, lobby phase only. Room field `dexSeated: boolean`. Dex counts toward `MAX_PLAYERS`.
2. **Start.** With Dex seated, the minimum is `MIN_HUMANS_WITH_DEX` humans; seats = humans + `DEX_ID`. `mode` stays `crew`.
3. **Clue release.** `dexReleased(state, now)` in `lib/game/dex.ts` (pure) returns which of Dex's clues are public, from `investigateStartedAt` and `DEX_RELEASE_SCHEDULE`. `buildView` shows released clues to every player and adds a feed line per release. No background job.
4. **Hints in crews.** `askDex 'hint'` works for any player; the hint and Dex's line go to the group feed and apply the room-wide penalty.
5. **UI** behind flag `dex_crew`: "Add Dex" in the lobby for the host; Dex's seat shown in the player list; released clues in a "Dex's notes" section.

## Tests

- 2 humans + Dex: start, investigate, vote, verdict; results rated as `crew`.
- Release schedule at each boundary (just before and after).
- Dex never counts as a voter; the vote finalizes when all humans vote.
- Minimum-player rules with and without Dex; Dex can't be added to a full room.

## Done when

- On a preview deploy, two accounts plus Dex finish a case.
- Done checks pass.

## Out of scope

- More AI detectives with their own personalities (Phase 2). Dex chatting in a group chat.
