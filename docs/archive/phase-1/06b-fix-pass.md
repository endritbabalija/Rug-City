# 06b · Fix pass: logic holes and UX

Oct 11, 2026 · @endrit

## Goal

Fix the logic holes and UX problems found in a code review and a solo playtest of the live build (Airdrop of Doom, Oct 11). The game has to make sense end to end: rules, scoring, flows and wording. **Case content is out of scope.** The built-in cases are placeholders; don't change or critique them.

## Before you start

- Slice 6 (case pipeline) is **built but not committed** on `phase1/06-case-pipeline`, and several fixes touch the same files (`engine.ts`, `Reveal.tsx`, `Home.tsx`, `lib/cases/checks.ts`). Ask Endrit to commit slice 6 first, then branch `phase1/06b-fix-pass` from it. Don't start on a dirty tree.
- Read `AGENTS.md`, `docs/phase-1/CONVENTIONS.md` and `docs/phase-1/DEFAULTS.md`. Every new provisional value gets a named constant and a row in `DEFAULTS.md`.
- Don't test in Telegram per fix: Endrit tests everything at the end of Phase 1. Tests plus the done checks are enough here.

## Fixes

Each fix lists what's wrong, where, and what to build. Where a fix needs a value, the default is given; record it in `DEFAULTS.md`.

### Rules and logic

**F1 · Dex's seat swallows suspects.**
`dealSuspects` deals over every seat including Dex's (`lib/game/engine.ts:79`, `suspectsFor` at :99). In solo (`seats: [player, DEX_ID]`) the player only gets suspects 0, 2, 4, and nobody can question 1 and 3. In the playtest, CryptoKiki and Marco couldn't be questioned. Crews with Dex lose suspects the same way.
- Deal suspects over **human seats only**. Clue dealing stays as it is (Dex keeps his clue hand).
- Update `lib/cases/checks.ts:46` and `tests/cases.test.ts:94`, which call `dealSuspects` with a seat count, so the checks match what rooms actually deal.
- Test: for every case, solo and crew with Dex at 2–5 humans, every suspect is reachable by at least one human; solo gets all suspects.

**F2 · An abandoned case can be replayed for full points.**
A finished case writes a `case_results` row, and that row is what makes later finishes unrated (`hasPlayed`, `settleSeat` in `lib/rooms.ts`). Start a solo case, read every clue, close the app, replay tomorrow knowing the answers: full rated points.
- Rule: **a player who has seen a case's clues has played it.** Record that when the investigation begins, for every human seat (`beginInvestigation` / the `ready` and `skip` actions). Suggested: a new `case_starts` table (player_id, case_id, room_code, at; unique on player_id + case_id), added in both stores, migration add-only.
- `hasPlayed` (or the replay check in `unratedReason`) counts either a result row or a start in a **different** room. The room being settled must not count against itself.
- Playtest rooms record nothing.
- Test: start a solo case, abandon at investigate, start the same case again, finish: unrated `replay`, and the second start still costs a case.

**F3 · A crew can get stuck in the briefing.**
The briefing ends only when everyone is ready or the host skips (`ready` / `skipBriefing`, `engine.ts:185`). An AFK host plus one AFK player blocks the room forever.
- After `BRIEFING_GRACE_MS` (default 3 min) any member can start the investigation, mirroring `callVote`'s overtime rule. Show the countdown on the Briefing screen to non-hosts.
- Test: a non-host is refused before the grace and allowed after it.

**F4 · Closing the vote early silently burns a player's case.**
The host can close the vote before everyone has voted (`closeVote`, `engine.ts:304`). Non-voters get a `no-vote` result: no points, and the case counts as played forever.
- Keep the rule; make it visible. When the host taps Close while someone hasn't voted, confirm inline: "Ben hasn't voted. Closing now means they earn nothing for this case." Non-voters see "Vote before the host closes it" with the grace countdown (`Accuse.tsx`).

### Money and charges

**F5 · Paying for a case you've already closed, with no warning.**
Home without the `districts` flag doesn't show which cases are closed (`CaseCard` only shows `played` when `showPlayed`), and hosting or soloing a closed case spends the free case or a credit for nothing.
- Show the Closed / New stamp on Home too.
- Solo on a closed case: confirm before charging: "You've closed this case. Replays earn no Clue Points. Use a case anyway?"
- Hosting a closed case stays allowed (friends still earn), with a one-line note: "You've closed this one; your friends can still earn on it."

**F6 · Running out of cases is a dead end.**
"Play solo" with no free case and no credits only shows a red toast (`CaseCard.tsx`, error `NO_CASES` from `consumeCase` in `lib/player.ts:63`). The message also says "host" for solo.
- On `NO_CASES`, open the pack purchase the way the Lobby does (`buy('pack5')`), then retry the solo start if it succeeds.
- Message: "You've used today's free case. Get a case pack to play more."

**F7 · Help penalties are hidden until the verdict.**
Hint (⭐10), Trace (⭐15) and Subpoena (⭐25) show only their price (`Investigate.tsx`, `Explorer.tsx`, `Interrogation.tsx`). The score cut appears only on the verdict screen. Only the Dex hint confirms first (`DexPanel.tsx`).
- Every help action confirms inline before use, with the same pattern as `DexPanel`: what it costs in Stars (if the player has none) and the penalty from `HELP_PENALTY`, "for everyone in the crew" in crew rooms.
- The Shop descriptions (`lib/catalog.ts`) state the penalty too, read from `HELP_PENALTY` (no literals).

### Flow

**F8 · There's no way back to a case in progress.**
Telegram's back button returns to Home from a room (`Game.tsx:64`), and Home doesn't show the open case. Endrit would have to remember the 5-letter code.
- Remember the last room code on the client (localStorage, wrapped in try/catch). On Home, fetch it. If the player is a member and the phase isn't `reveal`, show a banner at the top: "Case APWDQ in progress · Back to it ›". Clear it on reveal or when the room is gone.
- While in a room past the lobby, the back button asks first: "Leave the case? It keeps running and you can come back from Home."

**F9 · "Call the vote" ends the investigation in one tap.**
`Investigate.tsx:114`, no confirmation, even with time left.
- Confirm inline when time is left: "End the investigation and vote now? 9:12 left." No confirmation once time has run out.

### Wording

**F10 · Solo shows crew wording everywhere.** In solo rooms:
- `Briefing.tsx`: one button, "Start investigating", instead of the ready count plus "I've read it" / "Start now".
- `Interrogation.tsx:48`: "Your crew can't see these chats, so share what you learn." becomes "Only you and Dex are on this one."
- `Accuse.tsx:38`: "Everyone votes… host breaks ties" becomes "Your answer is final once you lock it in."
- `Reveal.tsx`: "Crew said:" becomes "You said:"; hide "The crew's votes" and the "Lead detective" tag; the `crew` points chip is labeled "Solved" instead of "Crew" (label only, keep the data key).
- `Shop.tsx`: "Packs let you host more" becomes "Packs let you host or play solo more."

**F11 · Three different times.** Home says "20 minutes", the timer counts 12 (`INVESTIGATE_MS`), full speed points last until the target (15). When the timer hits zero nothing visible happens.
- Home copy loses the fixed number: "A project just got rugged. Work out who, why, and where the money went, solo with Dex or with your crew."
- The timer is labeled "Suggested"; at zero it reads "Time's up · anyone can call the vote" (crew) or "Time's up · speed points start dropping soon" (solo).

**F12 · The vote screen misstates scoring.** `Accuse.tsx:38` says "The crew's majority answer is scored". Each player's Clue Points and rating come from their own vote; the majority sets the crew's verdict.
- Crew copy: "The crew's majority is the verdict. Your own vote decides your Clue Points."

**F13 · Home is hard to read for a new player.**
- The ⚖️ 🧭 💡 pills get labels ("⚖️ 0 Subpoenas", or a small caption row).
- "79 CP" becomes "79 Clue Points".
- "Free case used" next to "🗂️ 0 cases" becomes "Free case: used today" and "0 extra cases".
- Under the two buttons on a case card, one line: "Host: invite 2+ friends. Solo: you and Dex."

**F14 · The bot's welcome message ignores solo.**
`app/api/telegram/webhook/route.ts:50` says "You and 2–5 friends have about 20 minutes". Mention solo with Dex, drop the fixed time.

## Tests

- F1, F2, F3 as listed above, as unit tests on the pure rules plus one flow test each through `lib/rooms.ts` (`tests/flow.test.ts` pattern).
- F4: closing the vote early still works for the host and still writes `no-vote` for non-voters (behavior unchanged).
- F5: soloing a closed case still charges and writes an unrated `replay` (behavior unchanged; only the UI warns).
- Existing tests keep passing; update the ones that assert the old suspect deal.

## Done when

- Every fix above is in, or explicitly skipped with a reason in the status table.
- `npm run typecheck && npm run lint && npm test && npm run build` pass.
- `DEFAULTS.md` has rows for `BRIEFING_GRACE_MS` and anything else new; a migration exists for F2 if it adds a table, and Endrit is told to apply it.
- The status table in `docs/phase-1/README.md` has a `6b` row.

## Out of scope: decisions for Endrit

Don't build these; they change the design. List them back to Endrit at the end of the session if anything you built touches them.

1. **Fixed answers leak.** Every case has one answer key reused by every player; once prizes exist, answers will be shared in group chats. Options: per-room variants (shuffled names, alternate culprits), or rating only from cases nobody could have looked up.
2. **Help penalties hit the whole crew.** One player's Hint, Trace, Subpoena or Dex hint cuts every seat's score and Clue Points, with no consent. Options: penalize only the user; or require a crew vote; or keep it (F7 at least makes it visible).
3. **Two point systems.** The case score (50/25/25 + 20 time, out of 120) and Clue Points (30/15/15 + bonuses) look alike but don't match. Consider showing one, or renaming the case score (a grade).
4. **Power-ups only hurt.** Their only effect on everything the game rewards is a lower score, so good players never buy them. Decide what a power-up is for.
5. **Solo costs 6× more per player than crew.** One case for one solo player, one case for a whole crew. Fine if deliberate.
6. **Suspect chats are scripted in production** until `ANTHROPIC_API_KEY` is added after slice 9, so the "decisive clue comes from questioning" guardrail can't hold there yet.
