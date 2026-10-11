# Rug City

*Game direction · opening arc · case design and cooperative play*

Version 0.1 · 11 October 2026 · Planning companion for Claude

**Decision (11 Oct 2026):** Endrit has chosen this direction for Rug City. The earlier design (concept, Game Design v2, Phase 1 Plan) is archived in `docs/archive/` and is no longer a requirement. Player validation is still ahead: the cautions below about untested assumptions still apply.

# 0. Read this first

This pack captures the product direction agreed during discussion and develops four proposed case outlines. It is not an instruction to build all of them. None of the proposed interactions, pacing or commercial assumptions has been validated with players.

Use with **`Rug City — The Refund Brief.md`**, the detailed implementation brief for prototype 01. That brief remains authoritative for The Refund's evidence, dialogue, prototype scope and implementation limits. This pack clarifies the broader direction, especially that The Refund must not become a rigid template for every case.

Repository baseline previously reviewed: endritbabalija/Rug-City, commit 930b94dce1e70cf0c09c0971eb3233294c29917e. This is not a claim about current HEAD. Inspect current code before implementing. No repository files were changed to produce this pack.

## Decision status

| Status | Meaning here |
|---|---|
| Build now | The Refund solo prototype, under its separate brief |
| Direction to preserve | Evidence-driven investigation, varied reasoning, fair feedback, story continuity, reusable technical foundation |
| Proposed for testing | Two-player cooperation, cases 2–5 below, shared archive and evidence tools |
| Deferred | Three or more players, progression overhaul, paid story arcs, broader campaign and relationship systems |
| Parked | The Mole, cash prizes, competitive speed rankings, idle informants and construction timers |

Preserve repository engineering conventions and access controls. Old product documents (now in `docs/archive/`) describe the legacy design; do not treat any old feature as a requirement. Explain genuine conflicts.

# 1. The experience we want

Rug City is a detective adventure about uncovering the human choices behind fictional crypto scandals. The player's achievement is explaining what happened with evidence, including recognising when a suspicious fact does not prove guilt.

The working audience hypothesis is people who enjoy mysteries, internet culture and discussing theories, with crypto familiarity helpful but unnecessary. This is a target to test, not market research or evidence of demand. Telegram is an entry and sharing channel; its overall audience is not our acquired audience.

## Design principles

- Give the player something understandable to investigate immediately.
- Let reasoning change available conversations, leads or interpretations.
- Provide meaningful discoveries before the final answer screen.
- Make essential evidence available without payments or outside knowledge.
- Distinguish observed facts, testimony, inference and unsupported speculation.
- Give specific feedback on a weak inference without revealing undiscovered facts.
- Preserve facts across replay; do not swap culprits or invent new evidence to prolong play.
- Use a short local resolution in every chapter, with consequences carrying into the arc.
- Keep AI optional for performance and flavour. Never make truth or deduction depend on persuading a model.
- Make comparison, grouping and tracing accessible through taps, not mandatory drag gestures.

## A repeatable loop, with different reasoning

Notice something → form a theory → test it against records or people → revise or establish a finding → follow the resulting lead.

The verb pattern can recur. The thinking task, uncertainty, feedback and pacing must change. Do not turn every case into selecting two cards from the same menu and pressing Confront.

# 2. First arc: Selected Truths (working title)

A new agency gains attention after investigating its own client. A helpful analyst starts sending credible leads. Each solved case is real, but someone benefits from the resulting reputational collapses. The finale investigates that selection and manipulation.

The larger antagonist did not cause every crime. Lena acted independently. The agency's valid findings remain valid. Later interference aims to steer who loses influence and who buys the distressed assets.

## Chronology and handoffs

These are story-relative days, not real-time waits. A player can continue immediately when the next chapter is available.

| Chapter | Time | Why this case reaches the agency | Resolution and handoff |
|---|---|---|---|
| 1. The Refund | Day 1 | Lena hires the agency to blame Owen. | Lena's diversion is established. Mika offers a trusted introduction. |
| 2. The Crowd | Day 4 | Mika introduces Iona, organiser of another community. Analyst Sera helps obtain voting records. | A decisive ineligible voting cluster is established. Sera appears useful. |
| 3. The Second Rescue | Day 9 | Nell, a Lantern Club victim, reports an unreceived recovery. Sera supplies a public lead. | Recovery statistics are exposed as repeated circulation. Nell asks the agency to challenge the public evidence against the accused custodian. |
| 4. The Perfect Suspect | Day 13 | A dossier implicates Dex's old colleague Arun; it also concerns the assets Nell hopes to recover. | Arun's record-keeping fault is real; the allegation of personal theft is not supported. The source package was deliberately misleading. |
| 5. The Client List | Day 18 | Metadata and source records from chapter 4 lead back to the agency's own referrals. | The agency proves the referral scheme, who commissioned the misleading package, and the buyer benefiting from it. |

Chapter 1's existing prototype ending stays unchanged. Any later acquisition of Lantern Club assets is introduced through newly obtained records in chapter 5, not retroactively inserted as evidence players were supposed to notice in chapter 1.

## Recurring cast and development

| Character | Function | Development |
|---|---|---|
| Player | Investigator building an agency | Progresses from finding a contradiction to testing the assumptions behind their own work |
| Dex | Experienced partner | Has useful knowledge and a personal bias about Arun; acknowledges and corrects that bias without hiding evidence |
| Mika | Honest community contact | Opens the social world and helps put victims in contact with the agency |
| Nell | Person harmed by the original collapse | Gives consequences continuity; is not used merely as a repeated helpless victim |
| Sera | Helpful independent-seeming analyst | Supplies accurate leads early, conceals a paid relationship, later transmits a misleading dossier |
| Arun | Former colleague of Dex, escrow custodian | Careless about a disclosure deadline, but not guilty of the theft alleged against him |
| Vale | Principal of fictional Northline Acquisitions | Benefits from distressed purchases and commissions manipulation; no omnipotent control over every event |

All names and entities are provisional fictional content. Give each a concise character sheet before final writing. Avoid requiring encyclopedic recall of names.

## Three kinds of progression

1. Player skill: comparing, grouping, tracing, validating sources, synthesising.
2. Story access: introductions and evidence open the next chapter.
3. Recognition: optional agency history and solved-case collection later.

Rank gates, district unlocks and seasonal ratings must not block the five-chapter story arbitrarily. Districts can remain navigational settings later. A calendar-based competitive season is not the same thing as a story arc.

# 3. Case 2 design brief: The Crowd

**Status:** proposed design, not ready for implementation. Target first-play length to test: 12–16 minutes. Main reasoning: distinguish shared infrastructure from shared control.

## Hook

An apparently grassroots vote approved selling a community resource to a preferred buyer. Iona believes the result was manufactured. The loud campaign manager, Pax, appears connected to many accounts, but similarity is not ownership.

## Proposed truth

The voting registrar, Rook, secretly issues four additional credentials to accounts he controls. Each credential contributes one yes vote. The visible result is 9 yes, 6 no. Removing those four ineligible votes yields 5 yes, 6 no. No other votes are challenged. The announced rules allow one credential per verified person, decided by a simple majority of valid ballots, with no quorum complication.

Pax's supporters share funding from a legitimate onboarding service. Those similarities are real but insufficient to prove common control. Four fraud accounts use the same registrar exception and a custody arrangement controlled by Rook; attribution requires records independent of funding similarities.

## Evidence spine and provenance

- Public rules and signed result: establish eligibility and the 9–6 tally.
- Small ledger extract: seven inspectable account cards, plus eight aggregate ballots not under dispute. Four suspicious accounts voted yes; three comparison accounts are legitimate. Totals remain 15.
- Onboarding-service statement and receipts: explain why unrelated users share a funding source. Supplied by its operator on request, not by an unexplained omniscient search.
- Redacted credential audit from an authorised community auditor: shows four unverified exceptions approved under Rook's account, while the comparison accounts have distinct valid verifications.
- Custody authorisation voluntarily supplied during the internal investigation: independently names Rook as sole controller of the four challenged accounts during the vote.
- Ballot mapping: links exactly those four credentials to yes ballots. No assumption that suspicious accounts necessarily voted for the winning side.

The administrator's credential signature alone proves issuance, not ownership. The custody record proves control, not how the votes affected the result. Require both links and ballot mapping.

## UX and player's work

Start with a set of account cards and a tentative grouping board. The player can group, split and mark accounts unresolved. Each submitted group needs a stated relation: common funder, common controller, or common credential issuer. These are different claims.

Test the common-funder group first. Feedback confirms the similarity without endorsing the stronger ownership inference. A legitimate service explains the pattern; the player refines the grouping. Later, auditing isolates the four accounts whose control and eligibility can actually be proved.

The final interaction recalculates the outcome from the evidenced invalid ballots. The player sees the majority change. Do not demand arbitrary placement coordinates or a single group label.

## Local ending and arc contribution

Rook manipulated eligibility and determined the outcome. A direct accusation requires attribution and impact. Pax can be obnoxious without being guilty. Sera helped the agency identify an audit route; she need not confess or provide decisive truth herself. At this stage the buyer's broader interest is background, not proof of a conspiracy.

## Solo and co-op

Solo can access every account and source. In a pair, one person can inspect eligibility while another examines funding and custody. Proposed groups remain private drafts until shared. Shared findings require server validation, not agreement by majority.

## Acceptance questions before build

- Can a player explain why common funding does not establish common ownership?
- Are the four invalid votes and the corrected tally unambiguous?
- Does grouping change their reasoning, rather than adding busywork?
- Is every necessary private record available from a named, authorised source?
- Can players create overlapping relationship groups without the UI incorrectly merging them into one identity?

# 4. Case 3 design brief: The Second Rescue

**Status:** proposed design. Target length to test: 12–16 minutes. Main reasoning: transaction volume versus unique returned funds.

## Hook

Nell receives a message from recovery firm Harbor Recovery: “Your community's recovery has been completed.” Its dashboard claims 9,000 LUM recovered. Nell has received nothing.

## Proposed truth and controlled arithmetic

Harbor's manager Tavi circulates a single 3,000 LUM principal through A → B → C → A. The firm counts each 3,000 transfer as a separate completed recovery. Fees are separately funded and excluded from the puzzle. No other incoming or outgoing principal appears within this fully defined reporting window.

The dashboard therefore displays 9,000 LUM of transfer volume as recovery, while zero reached the verified victim destination V. The 3,000 returns to the starting account. We do not infer that A, B and C share an owner merely because they form a cycle; independent custody documents establish Harbor's control.

## Evidence spine

- Harbor dashboard export: three claimed recoveries, 3,000 each, total 9,000; names the reporting window and victim destination.
- Nell's victim claim and receiving record: she authorised destination V. The case provides the complete relevant reporting-window extract, not a partial screenshot mistaken for proof of absence.
- Transaction records: three transfers with ordered times and matching principal, plus beginning balances showing B and C begin with zero principal.
- Firm custody schedule, supplied by an employee responding to the complaint: maps A/B/C to Harbor's accounts, with an effective date covering the transfers.
- Original internal report: labels the entries “internal test transfers”, signed off by Tavi.
- Published export history: Tavi changes the reporting category to “victim recovery” before publication. Distinguish signed edit attribution from guessing who had access.

## UX and player's work

Trace the 3,000 through a compact map. Tapping an edge opens its record; following the last edge returns to the first node. Compare gross movement, unique principal and amount delivered to V. Use plain labels explaining the quantities.

The player marks transfers as internal circulation or victim payment and supports the classification. The tool calculates quantities from selected records; it does not silently announce fraud before the player establishes the relevant account control and report mismatch.

The last deduction establishes deliberate misrepresentation rather than an innocent bad dashboard. Present the internal categorisation and signed publication change. A confession is optional.

## Local ending and arc contribution

Harbor's recovery claim is false and Tavi knowingly published it. Do not claim that exposing it returned Nell's original losses. The helpful employee has been preserving records; obstructive early behaviour came from fear, not complicity.

Nell points to an escrow custodian accused in the public dossier of blocking recovery. The link motivates chapter 4. Sera's earlier public lead remains accurate. Later purchase of Harbor contracts by Northline is documented in chapter 5.

## Solo and co-op

One partner traces records; the other compares the report with custody and publication history. Every discovered transfer is shared. Do not let one player's viewport force the other's map position.

## Acceptance questions before build

- Can players distinguish 9,000 movement, 3,000 principal and zero victim repayment?
- Is the reporting window complete enough to justify the conclusion?
- Does circular movement alone remain insufficient to prove common control or intent?
- Does the mobile map remain legible without zoom gymnastics?
- Does the investigation feel different from a sequence of witness confrontations?

# 5. Case 4 design brief: The Perfect Suspect

**Status:** proposed design. Target length to test: 14–18 minutes. Main reasoning: provenance, omitted context and corroboration.

## Hook

A dossier appears to show Dex's former colleague Arun moving recovery assets into his own custody. Dex remembers Arun missing an important disclosure deadline years earlier and finds the new claim plausible. He gives the player the facts, including those that could exonerate Arun.

## Proposed truth

Arun moved assets to a legitimate escrow account under a valid mandate, but failed to publish a required notice on time. A dossier crops out the escrow authorisation and shows an old account-control page instead of the version effective on the transfer date. The authentic signature and transfer are made to look like personal appropriation.

The custodian committed a real process failure. That does not establish theft. Do not solve the case by making every record fake or by treating a technical metadata discrepancy as decisive alone.

## Evidence spine

- Dossier excerpts: signed payment record, cropped mandate, account-control screenshot.
- Full mandate from the issuer's archive: supplied on a reference-number request; includes escrow purpose and valid signatories.
- Effective-dated account register and countersigned transfer of control: establish the control change before the disputed payment.
- Complete escrow ledger and release terms: no personal payout to Arun; display the relevant bounded period and the authorised purpose.
- Disclosure log: proves Arun's real late notice.
- Dossier delivery/export manifest retained by the recipient: establishes it came through Sera and identifies the package version. It does not yet prove who commissioned or knowingly edited it.

## UX and player's work

Use a source comparison view: excerpt beside full record, with source, capture date and effective date separated. The player marks an assertion supported, contradicted or unresolved and attaches corroboration. “Authentic document” and “accurate implication” must be distinct statuses.

First correct inference: a genuine signature is not proof of a personal destination. Second: a screenshot may be genuine but out of date. Third: several apparently independent allegations originate in the same selected package.

Finish with a finding-based report rather than forcing a choice of thief: late disclosure supported; personal theft not established; dossier materially misleading. The record set supports these bounded conclusions, not a universal declaration of Arun's innocence in every matter.

## Emotional turn and ending

Dex acknowledges his bias: “I remembered the mistake. I stopped checking whether this was the same one.” Keep the apology brief. Arun remains imperfect. The agency retains the delivery manifest and seeks the source of the package, opening chapter 5.

## Solo and co-op

Partners can check different sources and compare assessments. A personal annotation that says “false” does not change the canonical status for the room. A verified finding can cite source versions so everyone sees why the status changed.

## Acceptance questions before build

- Can a player explain why a real document can support a misleading claim?
- Are full records discoverable through visible references, without pixel hunting?
- Are effective dates and publication dates clearly distinguished?
- Does the game let players preserve the genuine misconduct while rejecting the inflated accusation?
- Can the case end through a corrected account rather than the usual culprit selection?

# 6. Case 5 design brief: The Client List

**Status:** proposed arc finale. Target length to test: 18–25 minutes with pause/resume. Main reasoning: distinguish correlation from an evidenced commissioned scheme.

## Hook

The chapter-4 delivery record links the misleading dossier to Sera, the analyst who supplied helpful leads. Looking back, your agency sees the same purchaser appearing after the scandals. Is that ordinary opportunistic buying, or did someone direct the investigation for that purpose?

## Proposed truth

Vale, principal of Northline Acquisitions, paid Sera to identify genuine scandals and refer selected cases to the agency. Successful exposure reduced competing parties' bargaining power. Later, Vale commissioned the misleading dossier against Arun to remove an obstacle to a pending asset deal. Sera knowingly delivered that selected version.

Vale did not make Lena divert the refunds or make Rook and Tavi commit their independent misconduct. Benefiting from a scandal is not alone proof of causing it or commissioning fraud. The finale must establish the narrower paid steering and dossier manipulation with direct corroboration.

## Evidence spine and sufficient proof

- Prior-case recaps: retain findings and the actual referenced records, with clear case/date labels. No bonus for remembering exact IDs.
- Newly obtained dated purchase records: map Lantern assets, the chapter-2 resource transaction and Harbor contracts to a verified Northline ownership record. These establish benefit, not commission.
- Referral agreement voluntarily released by a former Northline employee authorised to retain their correspondence: identifies Sera, referral scope, payment terms and the agency. Treat the employee's accusation as testimony until records corroborate it.
- Payments and authenticated recipient acknowledgements: connect Northline to Sera and specific referrals before the relevant investigations.
- Commission message and the matching dossier manifest: Vale requests omission of the escrow authorisation; an acknowledged package version matches the dossier actually received. A message screenshot alone is insufficient; use the retained thread export and independent recipient copy.
- Agency intake records: show which tips arrived when. These establish chronology, not a retrospective assumption that all agency choices were externally controlled.

Before implementation, author exact amounts, dates, transaction references and message texts in a consistency ledger. Never let an AI invent these at runtime. The above is a proof structure, not a finished case dataset.

## UX and player's work

Build an agency board connecting cases, source contacts, purchases and documents. Relationship types matter: “benefited from”, “paid”, “referred”, “commissioned”. A common buyer creates a theory; corroborated payment and instruction records establish the scheme.

Let players submit intermediate explanations. “Vale caused all the crimes” should be rejected as overreach even after the broader scheme is proved. Final report identifies responsible acts precisely.

## Ending choice

The evidence and core public findings stay the same. Player chooses one of two trustworthy channels to publish the complete findings: the community network through Mika or an independent reporter introduced before the choice. Preview consequences: community trust versus wider reach. Both publish the same proven truth; neither choice should secretly lose the case. Do not implement this choice before both contacts and consequences are written.

Resolve the first arc fully: the agency establishes the manipulation and breaks the relationship. Future stories can follow reputation and relationships. Do not withhold the answer behind an endless mastermind tease.

## Solo and co-op

Everyone gets concise case recaps and accessible evidence. Partners can check different relationship types before proposing a shared report. For first story play, require all participating players to have completed chapters 1–4; mixed-progress joining uses explicit spoiler practice, described below.

## Acceptance questions before build

- Are the beneficial purchases clearly distinguished from proof of commissioning?
- Do chronology and independent corroboration establish the narrower wrongdoing?
- Do earlier valid solutions stay valid?
- Can a returning player follow the finale without remembering every detail?
- Is the final choice meaningful without changing the historical facts?

# 7. UX consistency without repetition

| Stable throughout | Varies by case |
|---|---|
| Case desk, People, Evidence | Main question and pace of uncertainty |
| Inspect record and inspect source | Compare, group, trace, assess provenance, connect cases |
| Draft theory and submit finding | Accepted claim and supporting relationship |
| Optional layered hints | Where the player may get stuck |
| Resume and readable archive | New discovery, exoneration, correction or supported accusation as ending |

Share small UI primitives, not a mandatory screen sequence. Reuse People where useful without forcing every case to unlock records through confrontation. Tools must help reasoning: an identity board is justified by overlapping relationships; a map by tracing a route; a provenance view by comparing versions.

Avoid five unrelated minigames requiring five tutorials. Teach the interaction in context with one small first task and use accessible tap alternatives. Never make animation precision, memory or reading speed a hidden skill requirement.

# 8. Solo and cooperative play direction

## Solo first

Every chapter is independently playable by one person with all necessary evidence available. Dex supplies companionship and optional help. He does not hold an inaccessible evidence hand, vote, or solve the case automatically. Saved progression is not a timer.

Build and test The Refund solo before implementing cooperative architecture. Sketch the future ownership boundaries now, but do not add network workflows that have no current use.

## First co-op experiment: two players

Same case truth, same evidence and same acceptable deductions. Players can pursue different leads, but discovered evidence enters a shared archive immediately. Initial lead suggestions allocate attention, not exclusive permission. No indispensable clue is permanently private.

Case-specific examples:

- Refund: one interviews Owen; one follows Mika's warning.
- Crowd: one examines credentials; one checks funding/control.
- Rescue: one traces transfers; one checks report definitions.
- Perfect Suspect: one checks chronology; one checks original sources.
- Client List: one investigates beneficiaries; one establishes commissioned actions.

Keep roles voluntary. Switching leads costs nothing. No player needs to ask permission to read a record or ask a normal question. Avoid first-click races: a conversation event applies once, and its shared transcript updates for everyone.

## Personal and shared state

| Personal | Shared |
|---|---|
| Current tab, map position, reading position | Discovered evidence and transcript |
| Draft account groups, routes and hypotheses | Accepted findings and case progression |
| Private annotations explicitly marked private | Published proposals and activity history |
| Unsubmitted final theory | Final accusation proposal and confirmations |

A player can publish a hypothesis without it becoming verified. Distinguish proposed from established. Supported findings validate immediately; no vote is needed to make a true finding true. Another player can comment through a small fixed reaction such as “Let me check” or “I see another link”; do not build an in-app chat platform now.

## Final confirmation and disconnections

Proposed policy to test: closing a co-op case requires both players' explicit confirmation of the same final proposal version. Editing the culprit, report or evidence invalidates prior confirmations. Validation still determines correctness. Agreement alone does not make an unsupported claim correct.

If someone disconnects, the other can continue investigating and viewing shared evidence but cannot silently submit the ending on their behalf. They can wait/resume, or explicitly choose “Continue alone in a personal copy”. This forks the discovered state into a separate solo run, leaves the co-op run unchanged and explains that the other player will not receive a completion. This fallback is a future co-op requirement, not part of prototype 01.

Two tabs for the same player are one participant. Reconnect restores identity and state, not a fresh vote. Simultaneous submissions use a state/proposal version; stale final confirmations must retry against the current proposal. Disconnect status never changes evidence ownership.

## Story access and spoilers

- Chapters unlock in story order, not by newest release or number of points.
- Normal co-op story run: both players meet that chapter's prerequisites.
- If one does not, offer explicit “Spoiler practice” before revealing the case briefing. It does not skip prerequisites or advance their campaign; no secret spoilers in the invitation.
- Previously completed players are labelled Replaying. Their knowledge cannot be removed; make it transparent.
- Both active, eligible, confirming participants may receive that chapter's completion record. Presence alone does not grant completion to an absent invitee.
- Story progress, replay history and shared run state are separate. Practice does not unlock later chapters. Solo-copy completion belongs only to its player.

## What co-op must prove

Test whether both players make discoveries, explain reasoning to one another and enjoy sharing theories. Track idle time and one-player dominance. Compare solo and paired observations qualitatively before claiming co-op improves retention. Expand to three only if there is enough useful parallel work. Four to six remains uncommitted.

# 9. Architecture direction for Claude

This is an architectural direction, not a demand for a large framework or a complete database redesign.

## Preserve useful foundations

Telegram authentication and shell; Next.js/React UI; Supabase and in-memory Store implementations; server-authoritative views; pure rule functions; versioned writes; feature flags; existing test patterns. The earlier crew game, its payments and progression were removed on 2026-10-11; reintroduce payments only with a later monetisation task.

## Separate three concepts

1. Case definition: authored truth, evidence, statements, claim support and access conditions. Hidden portions remain server-only.
2. Investigation run: which evidence and findings have been discovered, current dialogue state and progress, pinned to a content version.
3. Campaign progress: which chapters a player completed, spoiler/replay status and later narrative choices. Do not infer it from a list of started runs alone.

These are conceptual boundaries. In prototype 01 only case definition and single-player run need implementation. Record the campaign boundary in documentation rather than inventing its full persistence now.

## Share rules, permit different interactions

Findings should be identified by claims supported by known records. Refund may submit evidence sets; Crowd may submit membership relations; Rescue a path/classification; Perfect Suspect a source comparison; Client List relationship links. Each future interaction can have a small typed validator and view. Do not force all of them into the old culprit/motive/trail vote or a rigid two-card schema.

Do not prebuild every future validator. Implement Refund concretely. Once a second case demonstrates a real common pattern, extract the shared parts. Prefer small pure functions to a universal JSON rules language.

## Server authority and privacy

Client tools let players explore their known evidence and draft theories. Only the server establishes findings or grants new access. Source records, accepted answers and future scripts must not leak through bundled case files, hypothetical option lists or hint text. Requests use explicit action and evidence IDs; unknown IDs cannot disclose future titles.

For future co-op, room membership determines access to shared evidence. Personal drafts remain scoped to their author until published. Realtime notifications trigger authenticated refetches; they do not broadcast undiscovered content or private drafts. Persistent versioned writes handle concurrent actions and retries.

## Persistence and completion

Keep content versions stable per run. Restart creates a new run, not a destructive reset of another participant's session. Future campaign completion needs a unique player/chapter entitlement record and idempotent application. Do not tie resolution to charges, prizes, ranks or referral rewards.

## What Claude should produce now

- A short comparison of current architecture with Refund's needs.
- The isolated solo Refund implementation under its brief.
- A concise prototype architecture note distinguishing implemented pieces from future extension points.
- Actual test/build results and remaining manual checks.

Do not implement co-op, cases 2–5, a campaign service, AI authoring, payment offers or a new roadmap merely because they are described here. The legacy engine has already been removed; don't rebuild its systems.

# 10. Product and commercial hypotheses

Potential offer to test after a satisfying opening case: a free complete introduction, paid connected arcs, and a host entitlement allowing a friend to join. Exact pricing, free cadence and the meaning of hosting access remain undecided. No paywall, credit logic or shop is part of this prototype.

Distinguish shared access from permanent ownership: a future host purchase could admit guests to the hosted arc without granting them an unrestricted solo copy. Explain this clearly before purchase if chosen. Guest story completion must still be preserved independently of access entitlement.

No player testing or revenue projections support these assumptions yet. Measure actual desire for another case before building recurring monetisation. Later assess purchase conversion, content production cost, support, AI costs if introduced, and acquisition costs. This pack is not a forecast.

# 11. Build sequence and decision gates

| Stage | Deliverable | Evidence needed to continue |
|---|---|---|
| A | Refund solo | Players understand the problem, make supported deductions and finish without continual coaching |
| B | Revise Refund | Major unfairness, boredom and access dead ends addressed through observed play |
| C | A small Crowd interaction test | Grouping relationships feels different and aids reasoning |
| D | Refund two-player test | Both players contribute and disconnect/rejoin does not break access or consent |
| E | Finalise full arc evidence and chronology | Each case's proof works; recurring facts stay consistent |
| F | Produce next chapters and test a paid arc offer | Players voluntarily choose more; sustainable delivery effort is understood |

Stages C and D can be ordered according to the biggest uncertainty; this is not a schedule. Small observed sessions diagnose usability and enjoyment, not statistically reliable business outcomes. Do not claim retention or revenue validation from a few friendly playtests.

Before any later case receives an implementation brief, complete its exact truth ledger, evidence texts, source provenance, accepted claims, alternate paths, incorrect feedback and human walkthrough. The current four briefs intentionally stop short of those build-ready details.

# 12. Handoff message for Claude

Read this Game Direction and Case Design Pack and the separate Refund build brief before implementing. We are exploring a story-led detective adventure because the earlier design developed many progression systems before validating the core investigation.

The Refund is the only case to build now. The four later cases describe future reasoning tasks and narrative continuity so you avoid hardcoding every case as the same compare/confront loop. Do not implement those future systems pre-emptively.

Inspect current main and engineering instructions. Explain what you can reuse, what Refund needs and what stays separate. Build the isolated solo prototype exactly within its scope, document its architecture and run the required checks. Keep the existing game working beside it and follow the brief's rules for merging, deploying and shared data. Flag genuine contradictions rather than silently inventing story facts.

This pack does not replace the detailed Refund brief or broaden its implementation permission. If Refund is already being built, use this as context and document extension points; do not restart it merely to design a framework.
