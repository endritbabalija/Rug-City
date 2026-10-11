# Rug City: The Refund

*Claude implementation brief · Prototype 01*

Prepared 11 October 2026. Design baseline: endritbabalija/Rug-City, main reviewed through 930b94dce1e70cf0c09c0971eb3233294c29917e (PR #10). Inspect current HEAD before implementation; do not reset or overwrite newer work.

**Status:** approved implementation specification. This file does not claim the case is implemented or playtested. Names, dialogue and values below are authored fictional content.

**Decision (11 Oct 2026):** Rug City is pivoting to the direction in `Rug City — Game Direction.md`. The Refund is chapter 1 of the new game, not a side experiment. The earlier design is archived in `docs/archive/`.

# 1. Task and intended outcome

Build one complete solo investigation in the existing Telegram Mini App. It must demonstrate: inspect evidence, connect facts, challenge a specific lie, gain new evidence, and submit a supported accusation. The central experience is catching someone in a lie without assuming that every liar is the thief.

The player should feel that their reasoning changes the investigation. Test an 8–12 minute first playthrough, without forcing that duration or imposing a countdown. Whether the moment-to-moment play works is still unproven until observed playtests (section 11).

Read `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/ops/environments.md`, and the relevant installed Next.js guides before writing code. Preserve the conventions on pure rules, store parity, server authority, validation and additive migrations. The old Phase 1 plan is archived; its features are not requirements for this task.

Use a new branch such as `refund/the-refund`. Implement and verify locally first. Follow repository rules for committing (`docs/CONVENTIONS.md`): one PR into `main`, merged only when Endrit asks. Migrations are additive and are applied to the shared database, the preview repointed and the `refund_prototype` flag switched on only when Endrit asks to test, following `docs/ops/environments.md`. The earlier crew game was removed from the code on 2026-10-11; only the foundation (Telegram auth, store, flags, analytics, noir UI primitives) remains.

## In scope

- One authored case and deterministic dialogue topics.
- Three suspects plus a creditor contact unlocked during investigation.
- Evidence inspection and comparison, pinned statements, findings, confrontation and final accusation.
- Optional timeline aid and three-level scripted hints.
- Saved progress and resume, mobile Telegram layout, analytics, meaningful tests.
- A feature flag, off by default, and an isolated entry point.

## Out of scope

Crew play; restoring any part of the removed crew game; new districts; paid help; purchases; credits; ratings; reward settlement; streaks; cash prizes; free-text AI chat; case generation; a general visual case editor; a second playable chapter; live notifications to users. The final chapter teaser is clearly marked as unavailable.

Do not implement a generic workflow engine. Use a small typed case model and explicit rules sufficient for this case, with room to add another authored case later.

# 2. Design rules

1. Evidence, not a mandatory confession, must establish the ending.
2. Receiving information does not automatically establish its deduction. The player must submit a supported connection.
3. Necessary evidence and ordinary questions are free. No inventory deductions or hidden consumption of a hosted case.
4. Wrong theories produce specific, non-spoiling feedback. They never consume evidence, currency or attempts and never permanently close the case.
5. Accepted reasoning is deterministic and runs on the server. No LLM judges correctness or controls evidence access.
6. Several supported orders are valid. Do not force the player through a fixed sequence of tabs or require a timeline interaction after they already understood the chronology.
7. Keep factual record, testimony and inference visually distinct. A suspect statement is not verified evidence merely because it appears in a chat.
8. Short explanations make all essential crypto concepts understandable within the game. No outside knowledge is required.
9. All institutions, people, wallet labels, coin units and documents are fictional. Do not integrate real financial services or look up real people.

# 3. Canonical truth and continuity

The fictional community project is Lantern Club. Its remaining 12,000 LUM were publicly promised as community refunds. LUM is an invented story unit with no real asset, balance or value.

Lena, the founder, owes 12,000 LUM personally to Cedar Studio, a former business partner. The obligation is unrelated to the project. She knowingly approves a replacement payment instruction directing the refund fund to her private Relay Desk account. Owen, the treasury operator, follows those instructions. Lena uses the receiving account to pay Cedar Studio. She then claims Owen substituted the destination after approval.

Owen conceals his failed reversal attempt because he is ashamed and afraid of being blamed. He is careless, not the thief. Mika, the moderator, noticed the discrepancy and keeps the community and expense records. She is honest and does not arbitrarily withhold evidence.

Lena hires a new, inexpensive agency expecting a report blaming the operator shown in the transfer record. She assumes Owen will conceal his reversal request and that public transactions will not connect her to the receiving account. She does not know he attached the immutable approval receipt to his support request or that Mika retained the old account authorisation record.

## Fictional identifiers

| Identifier | Meaning |
|---|---|
| COMMUNITY-04 | Intended community refund destination |
| RELAY-72 | Actual receiving destination |
| RD-204 | Relay Desk account associated with RELAY-72 |
| PAY-17 | Payment instruction and approval identifier |
| TX-101 | Project's transfer to RELAY-72 |
| TX-102 | Onward transfer to Cedar Studio |
| CS-88 | Lena's personal settlement reference |

Display these labels consistently; they are deliberately not real wallet addresses. All timestamps are on the same fictional Case Day unless marked Day −1. No time zones, gas calculations or exchange rates form part of the puzzle. Amounts are principal; fees are paid separately and are not clues.

## Authoritative chronology

| Time | Event |
|---|---|
| Day −1, 16:00 | Cedar Studio demands Lena's personal payment of 12,000 LUM, due Case Day at 18:00. |
| 09:00 | Mika publishes refunds to COMMUNITY-04; Lena approves the public plan. |
| 09:42 | Lena approves PAY-17, explicitly replacing COMMUNITY-04 with RELAY-72. |
| 10:00 | Owen executes TX-101 for 12,000 LUM to RELAY-72. |
| 10:08 | Mika flags the mismatch to Owen; Owen replies. |
| 10:12 | Owen requests a reversal and attaches the approval receipt. |
| 10:20 | RD-204 sends 12,000 LUM to Cedar Studio in TX-102, reference CS-88. |
| 10:28 | Relay Desk replies that completed transfers cannot be recalled; the response maps the receipt's destination to RD-204 and links the public onward transfer. |
| 11:00 | Lena hires the agency and blames Owen. |

No evidence is mysteriously created by player progress: records already exist and become accessible through plausible conversations. Do not imply hacking, tampering with a signature or account compromise without authored evidence. Those are not alternative solutions in this closed fictional case.

# 4. Evidence content and provenance

These are the minimum factual texts. Light copyediting is allowed, but preserve the facts, chronology and uncertainty. Hidden evidence definitions remain server-only.

| ID | Title / source | Required visible content | Availability |
|---|---|---|---|
| E01 | Refund announcement · Mika's public archive | 09:00. "The remaining 12,000 LUM will go to COMMUNITY-04 for community refunds. Founder sign-off: Lena." | Initial |
| E02 | Transfer receipt · public transaction | TX-101. 10:00. 12,000 LUM from Lantern Club treasury to RELAY-72. Submitted by Owen. "The operator submits a payment; this record does not identify the destination owner." | Initial |
| E03 | Warning conversation · supplied by Mika | 10:08 Mika: "The refund post says COMMUNITY-04. You sent to RELAY-72." 10:09 Owen: "I see it. I'm contacting support. Please give me a minute." | Ask Mika about the mismatch after F01 |
| E04 | Reversal request · supplied by Owen | Ticket 10:12, TX-101. "I used approved instruction PAY-17. The public address differs. Can you reverse this? Approval receipt attached." | Successful Owen confrontation |
| E05 | Approval receipt · immutable Relay Desk record, attachment to E04 | PAY-17, 09:42. Approver: Lena, verified founder account. Destination changed COMMUNITY-04 → RELAY-72. Amount 12,000 LUM. Approval note: "Use the replacement destination." "This receipt preserves the exact destination approved at this time; later document edits cannot change it." | With E04 |
| E06 | Support response · attached to E04 | 10:28, relates to TX-101. "Completed transfers cannot be recalled. Receiving destination RELAY-72 belongs to account RD-204. Public onward transfer: TX-102." No account-holder name or private creditor information. | With E04 |
| E07 | Older account authorisation · Mika's expense archive | Day −30. Account RD-204, destination RELAY-72. Account holder Lena. Personal account; sole authorised controller Lena. Project expense claim submitted by Lena. "This is my personal Relay Desk account." Label as retained service authorisation attached to that claim, not a guess based on a payment. | Present RD-204 from E06 to Mika; not gated on unrelated findings |
| E08 | Onward transfer · public ledger | TX-102, 10:20. 12,000 LUM from RELAY-72 to CEDAR-11, reference CS-88. CEDAR-11 has a verified public business listing: Cedar Studio, settlement enquiries. | Inspect link in E06 |
| E09 | Creditor records · voluntarily supplied by Cedar Studio | Two tabs: demand Day −1 16:00, "Lena: personal settlement CS-88, 12,000 LUM due tomorrow 18:00, unrelated to Lantern Club"; receipt Case Day 10:20, "CS-88 settled by TX-102, 12,000 LUM." | Contact Cedar via E08 and ask about CS-88 |

E09 is voluntary information from a fictional business, not a subpoena or unrestricted access to a private inbox. It corroborates records the player already has. E07 names the owner because Mika possessed that earlier authorisation legitimately; the public ledger does not expose that identity.

# 5. Suspects and deterministic dialogue

Give each suspect a recognisable tone without long monologues. Replies should usually be one to three sentences. Character portraits can use the existing lightweight visual treatment; new generated art is not a prerequisite.

## Lena · client / founder

- Opening: "Our refund money never reached the community. Owen handled the transfer. Find out what happened."
- Initial pinned statement S-L1: "I approved COMMUNITY-04. Owen must have changed the destination afterwards."
- Ask about approval: repeat her precise claim, not a new alibi.
- Challenge S-L1 using F02: "Fine. I approved RELAY-72. It was a temporary holding account. The community was still going to be paid." Pin S-L2.
- Challenge S-L2 using F03 + F04: "Cedar wouldn't wait. I thought I could replace the money before anyone noticed." This line adds emotion, not a new essential fact.
- Optional pressure line after F01: "Surely you have enough for a report on Owen? I can pay extra if you finish today." Declining or ignoring it has no economic effect.

## Owen · operator

- Initial pinned statement S-O1: "I sent what the approved instructions said, then went offline straight afterwards."
- Ask about instructions after F01: "PAY-17 was signed off. I didn't choose the destination."
- Challenge S-O1 with E03: "I stayed online. Mika warned me and I panicked. I tried to reverse it. Here's the ticket, with the approval I followed." Unlock E04/E05/E06 together.
- Repeat confrontation: show the prior outcome; do not create duplicate evidence or transcript spam.

## Mika · moderator

- Opening: "The community announcement has the correct address. I kept a copy."
- Ask about mismatch after F01: supply E03 immediately. "I warned Owen as soon as I saw it. He answered."
- Present RD-204 (requires E06): supply E07. "I recognise that account. Lena used it on an old expense claim. I still have the account authorisation she attached."
- Before seeing RD-204, Mika has no reason to search an old claim. Once asked about that identifier, she never withholds it to enforce an arbitrary order.

## Cedar Studio · contact, not a fourth suspect

- Accessible only through the verified public listing on E08.
- Topic "Ask about reference CS-88": "That was Lena's personal settlement with us. It was paid this morning. We can share our demand and receipt." Unlock E09.
- Cedar had no role in redirecting the refund payment. Do not invent complicity.

Default topic actions are buttons. Pinning is optional convenience; it is never a progression gate. The player can challenge directly from an available statement in the transcript. No free-text prompt or model call is required.

# 6. Finding and confrontation rules

Player actions submit claim IDs and evidence IDs, not a boolean saying they succeeded. Check membership, flag/access, case version, known evidence, supported combination and state on the server. Evidence order is irrelevant. Accept duplicates idempotently.

| Finding | Claim | Accepted support | Unlock / effect |
|---|---|---|---|
| F01 | "The transfer used a different destination from the announced refund plan." | E01 + E02 | Mismatch topics with Owen and Mika |
| F02 | "Lena approved the disputed destination before Owen sent the payment." | E05 + E02 | Lena approval confrontation available |
| F03 | "Lena personally controlled the receiving account." | E06 + E07; or E08 + E07 (direct destination match) | Ownership finding; no confession required |
| F04 | "The diverted 12,000 LUM paid Lena's pre-existing personal obligation." | E02 + E08 + E09 | Personal-use finding |

Final proof uses all four findings. F02 alone does not establish motive; F03 alone does not establish theft. F04 establishes personal use and prior obligation, not an unsupported claim that Lena was bankrupt or had no other funds.

An evidence set containing a valid subset can be accepted if all submitted cards are already discovered; mark the subset that actually supports the finding. Unrelated extra evidence does not count as additional proof. Use the same validator for submissions from comparison, timeline and case desk.

For each available compare action show a small curated choice of claims. Include plausible wrong inferences; do not manufacture unlimited combinations. Never expose later claim options whose text reveals undiscovered facts. The client receives only currently available options, not accepted-support tables.

## Confrontations

- **C01:** S-O1 + E03 + claim "You were online and knew about the mismatch after the transfer." Requires F01. Unlocks E04/E05/E06.
- **C02:** S-L1 + F02 + claim "This destination was already present in your approval." Changes Lena's account and reveals S-L2.
- **C03:** S-L2 + F03 + F04 + claim "The funds paid your own prior obligation." Optional confession.

C02 and C03 are satisfying interactions, but are not required to submit the final proof. C01 is required to gain Owen's records in this case. E04/E05/E06 remain available thereafter regardless of later dialogue.

## Wrong-action feedback

- E02 → "Owen owns RELAY-72": "This shows who submitted the payment, not who owns its destination."
- E03 → "Owen stole the money": "This contradicts his claim about going offline. It does not establish who chose or owns the destination."
- E05 alone → "Lena paid a personal debt": "This records her approval, not what the receiving account did next."
- Any valid but insufficient evidence set: explain the missing logical link without naming a hidden document, future recipient or culprit.
- Unknown evidence IDs: reject without returning hidden titles or facts.
- Unsupported pair: "These records do not establish that claim yet." No random punishment, no escalating lockout.

# 7. Mobile player journey

## Entry and resume

Behind `refund_prototype`, show a clearly labelled prototype card or isolated route. A fresh run opens on Lena's message and "12,000 LUM sent. No refunds received." One button: **Open the case**. Existing runs offer **Continue**. Start does not charge legacy free cases or credits.

## Case desk

Show the current question, discovered findings and recent leads. Initial question: "Did the transfer match the announced refund plan?" Once F01 exists, use a broad question such as "Who authorised the changed destination?" Avoid a mandatory numbered checklist that reveals the solution.

Three tabs: Case desk, People, Evidence. Direct context links take a player from a finding to a relevant person or record. The selected person, inspected card and drafts can be local UI state; evidence, findings and progression must survive reload.

## Evidence

Readable cards with source and timestamp. Inspect opens full text. Compare shows two cards in a mobile vertical stack; support adding a third for F04. Tap-to-select controls are mandatory; do not depend on dragging. Highlight matches/differences after deliberate player selection or successful reasoning, not automatically on first load.

## People

Suspects show their current statements, topic buttons and a Challenge action. Asking or challenging updates the transcript and clearly announces new records. Keep evidence selection usable from the conversation. Distinguish a changed story from a proven finding.

## Optional timeline

After E05 is discovered, the player can arrange approval, transfer and warning using tap or up/down controls. Correct chronology offers F02 submission using E05/E02. Never forces a replay if F02 already exists. A wrong ordering identifies the conflicting visible timestamps, not the culprit.

## Final accusation

Accessible once F01 exists so early theories can be tested. Select culprit and attach established findings to three claims: payment diverted (F01), destination approved by Lena (F02), receiving funds controlled and used personally (F03/F04).

Lena + all required findings completes the investigation. Lena without complete proof returns "Your theory needs more support" with feedback limited to established facts. Owen/Mika gets evidence-specific objections without unlocking the true answer. The player can return to investigation. No irreversible submit until a supported solution is accepted.

## Ending

Reconstruct events using the player's findings; distinguish Owen's concealment from Lena's diversion. Do not claim the money was recovered. End with Lena refusing the invoice, Dex: "First client. First invoice dispute. Strong start." Mika: "You investigated the person paying you. I know someone who needs that."

Buttons: **Review evidence**, **Restart prototype** (clear confirmation and a new isolated run), **Back home**. "Next case: preview only" may be displayed but must not look like a working purchase or launch button.

## Presentation and accessibility

Reuse the noir paper/evidence visual language. Clear hierarchy, comfortable body text, minimum practical tap targets around 44 px, keyboard focus, no colour-only meaning. Respect Telegram safe areas and BackButton. No forced animation delays, countdown, shop modal, wallet connection or unexplained blockchain jargon.

# 8. Dex and hints

Dex is a companion, not an answer dispenser or a second seat in this prototype. Use scripted contextual lines. No separate stash of half the clues. Do not automatically summarise a new record before the player can inspect it.

Three hint levels per unresolved reasoning step; player explicitly requests each level. Free, no score penalty; record usage only for playtest learning.

| Step | Nudge | Direction | Explicit help |
|---|---|---|---|
| F01 | "Did the payment follow the announcement?" | "Compare the two destination labels." | "COMMUNITY-04 and RELAY-72 differ. That establishes a changed destination, not ownership." |
| C01 | "Does Owen's account fit what Mika remembers?" | "Ask Mika about her warning, then compare Owen's reply with his offline claim." | "Use the warning chat to challenge his claim that he went offline immediately." |
| F02 | "What had been approved before the transfer?" | "The approval receipt preserves a destination and a time." | "Compare E05's 09:42 approval with E02's 10:00 transfer." |
| F03 | "Do we have anything identifying that account?" | "Show the support response's account ID to Mika." | "Connect the receiving account record with Mika's old account authorisation." |
| F04 | "Where did the receiving account send the money?" | "Follow the onward transfer in the support response and ask the listed business about its reference." | "Connect the incoming transfer, onward transfer and the creditor's demand/receipt." |

Convert evidence IDs to player-facing titles in actual dialogue. Hint prerequisites prevent mentioning E05 before C01 or the creditor before the outward-transfer lead is available. When a hint directs a yet-unasked conversation, identify only the contact already known. All discovered information remains accessible after hint use.

# 9. Implementation approach

Inspect current code rather than copying stale APIs from this brief. Relevant existing paths include `lib/server.ts`, `lib/errors.ts`, `lib/store/*`, `lib/flags.ts`, `lib/analytics.ts`, `lib/telegram/*`, `lib/client/api.ts`, `components/Game.tsx`, `components/Home.tsx` and `components/ui.tsx`. The removed crew game's evidence and suspect screens (`components/evidence/*`, `components/phases/*`) and its pure-rules/projection pattern (`lib/game/engine.ts`, `lib/game/view.ts`) can be read in git history at commit `930b94d` for visual and structural reference; do not restore them.

Suggested small modules: `lib/investigation/types.ts`, `rules.ts`, `view.ts`, `refund.ts` (server-only content), a service and a few investigation components. Actual layout should fit the repository. Do not import hidden content into client bundles.

## Persisted run

Minimum fields: run ID, owner player ID, case ID `the-refund`, case version, state version, status (`intro`, `investigating`, `resolved`), discovered evidence IDs, findings, completed confrontations, visited topics, scripted transcript events, hint levels, created/updated/resolved timestamps. Pinning may also persist. Do not use time to gate narrative access.

Use optimistic concurrency consistently with the current store. Each accepted action adds evidence/findings once; retries and two tabs cannot regress state, duplicate transcript events or charge anything. Failed actions leave durable state unchanged. Preserve the authored case version for a run; do not silently reinterpret old evidence if content changes.

If a separate table is needed, add the next unused migration number for an `investigation_runs` table with RLS and server-only access, plus both Store implementations. Do not edit an already merged migration. Server owns timestamps. Resume is per authenticated user and run ID, not only localStorage. A run ID from another account must not expose even the intro state of that account's run.

## Actions and projection

Minimal actions: start/resume, open topic, submit finding, confront, request hint, submit accusation, restart as a new run. Existing GETs should not silently advance a story. Read-only inspect/pin UI actions need no server call unless needed for analytics or persistence.

Projection contains discovered evidence, established findings, visible statements/topics, transcript and available interaction options. Withhold answer tables, undiscovered records, full source scripts and future narrative. On successful unlock return new projected state; rejected guessed IDs must not leak undiscovered content.

Reuse Telegram authentication, dev auth, route/error helpers and zod schemas. This prototype makes no AI API calls. Do not add provider keys or packages merely for dialogue. Feature gating must happen on server endpoints as well as navigation. In local dev `FLAGS=refund_prototype` enables the case; the shared flag stays off until Endrit asks.

## Analytics

Use the existing non-blocking tracker. Events: `investigation_started`, `evidence_opened` (deduplicated per record/run if practical), `finding_attempted`, `finding_established`, `confrontation_attempted`, `confrontation_resolved`, `hint_requested`, `accusation_submitted`, `investigation_completed`, `investigation_resumed`.

Use run/case/version/action IDs, success and hint level; never store raw chat text or document contents as analytics. Do not send events to external people. Completion is idempotent. Record active-session duration separately from elapsed wall time if measuring duration; never count time while the app is hidden as active reading. Analytics failure cannot block progress.

# 10. Acceptance and validation

## Functional paths

1. With the flag off, Home shows its placeholder and prototype starts are refused by the server.
2. Flag on: a new user reaches the first evidence comparison without shop, district-selection or credit requirements.
3. Complete one full path using only scripted topics and records, without AI credentials.
4. Branch test: after C01, establish F03/F04 before challenging Lena about approval; the case still resolves.
5. Another valid path establishes F02 first, then F04, then F03. No unrelated prerequisite prevents it.
6. Complete with F01–F04 but without C02/C03. The ending must not pretend the player obtained a confession they never heard.
7. Repeat accepted requests, reverse selected evidence order, supply valid subsets plus irrelevant known evidence, and submit from two tabs. State remains consistent.
8. Reload after C01 and after F03; resume exactly the discovered evidence and conversation state, including hints. Restart creates a separate run.
9. Early wrong accusations preserve progress and give bounded feedback. The same known evidence can support several findings where valid.

## Security and isolation

- Non-owner and unauthenticated run access is rejected.
- Guessed undiscovered evidence/finding/confrontation IDs cannot unlock progress.
- Intro and intermediate projections contain no hidden approval, ownership, creditor records or final solution table.
- Request payload limits, validation and existing error handling apply.

## Content checks

- Every identifier, timestamp, amount and causal relation agrees with sections 3–6.
- Every mandatory evidence record is reachable; no gate requires the very finding that the record is needed to establish.
- Every accepted claim has sufficient evidence; neither guilt nor intent depends on confession.
- Ledger information is distinguished from private ownership records and voluntary creditor disclosure.
- The final explanation does not introduce a new decisive fact.
- No text claims recovery of funds, a paid invoice or a working second chapter.

## Verification to perform

Run the repo's typecheck, lint, tests and build. Add targeted pure-rule and store-flow tests for the criteria above; preserve meaningful existing regression coverage. Inspect the new experience at mobile dimensions and with keyboard controls if local browser tooling is available. Run the happy path and one alternate path manually; report any browser/Telegram checks you could not perform. Do not label code tests as human playtest evidence.

Deliver changed-file summary, checks and results, exact local launch steps, any additive migration awaiting application, and screenshots only if available from actual inspection. No fabricated test counts or deployment claims.

# 11. Human playtest after implementation

First run a handful of observed solo sessions. Ask users to think aloud lightly; do not coach them through the deductions. Watch whether they can explain why evidence supports a claim, whether they notice Owen's lie, and whether the reversal toward Lena feels earned. Track assistance, dead ends and exits. Small samples are diagnostic, not retention or revenue validation.

After completion ask: "What convinced you?", "What felt unfair or tedious?", "What do you think happened to the money?" and "Would you choose another case now?" Do not prompt them to praise the game. Cooperatively split evidence only after the solo puzzle is understandable and satisfying.

Do not add features to compensate for a weak case. Revise the evidence, clarity and interactions first.

# 12. Copy-and-paste kickoff prompt

> Read `Rug City — The Refund Brief.md` completely, then inspect the current Rug-City main branch, `AGENTS.md` and repository conventions. Implement this isolated solo investigation prototype on a new local branch. Treat the brief as the current product scope; the previous Phase 1 roadmap is background, not a requirement to add more systems. Preserve the existing game.
>
> Start with the canonical case data, pure rules and server projection; implement persistence and the mobile player journey; then run the required checks. Resolve routine implementation details yourself. If the evidence or gating has a genuine logical contradiction, flag it explicitly before changing the story. Do not invent extra mechanics or rely on AI to judge deductions. Finish with a runnable local prototype and verification report. Follow the brief's limits on commits, deployment and shared database changes.

## Reference snapshot

- Repository: https://github.com/endritbabalija/Rug-City
- Reviewed baseline: https://github.com/endritbabalija/Rug-City/commit/930b94dce1e70cf0c09c0971eb3233294c29917e
- Existing conventions: `docs/CONVENTIONS.md`
- Product direction and fictional case content: authored in the current planning conversation; this brief resolves the provisional shared-login and evidence-provenance ambiguities.
