# Architecture: The Refund

**Status:** implemented on branch `refund/the-refund` behind the `refund_prototype` flag (off by default). Not yet playtested by people. Sources: `Rug City — The Refund Brief.md` (scope, content, rules) and `Rug City — Game Direction.md` §7–9 (boundaries for later chapters and co-op). The previous architecture note is in `docs/archive/Architecture.md`.

## 1. What it reuses

| Foundation | Used for |
| --- | --- |
| `authenticate()`, `route()`, `errorResponse()` (`lib/server.ts`) | Every investigation route; Telegram and dev auth unchanged |
| `AppError` (`lib/errors.ts`) | Rejected actions (400), missing or someone else's run (404), oversized body (413) |
| `Store` + `withRetries`/`CONFLICT` (`lib/store/*`) | Four run methods in both memory and Supabase stores, same compare-and-swap as `updatePlayer` |
| `flag('refund_prototype')` (`lib/flags.ts`) | Every investigation route, and `/api/me` → `features.refund` for the Home card |
| `track()` (`lib/analytics.ts`) | The ten events in brief §9 |
| `api()`, `lib/telegram/webapp.ts` | Client calls, BackButton, haptics |
| `components/ui.tsx` | Button, Tape, Stamp, Label, Pill, Sheet, Confirm |

Nothing from the removed crew game was restored.

## 2. Three concepts, kept apart (Game Direction §9)

1. **Case definition**: authored, versioned, server-only. `lib/investigation/cases/refund.ts` (`THE_REFUND_V1`) holds the evidence texts, people, lines, statements, topics, claims (real findings and plausible wrong ones, with their feedback), challenges, hints, timeline aid, case-desk questions, Dex lines, accusation and ending. `cases/index.ts` registers every version; `getCase(id, version)` reads the one a run is pinned to.
2. **Investigation run**: one player's progress, pinned to `caseId` + `caseVersion`, holding only ids (`RunProgress` in `lib/investigation/types.ts`). Text is always read back from the pinned definition.
3. **Campaign progress**: **not built**; see §7.

Personal UI state stays on the client: tab, selected person, inspected record, compare/challenge/accusation drafts, and statement pins (`localStorage`, keyed by run id, never needed to progress).

## 3. Persisted run

Migration `supabase/migrations/0009_investigation_runs.sql` (additive, `if not exists`, RLS on with no policies). **Not yet applied to the shared database.**

Columns: `id uuid`, `player_id`, `case_id`, `case_version`, `status` (`intro` / `investigating` / `resolved`), `doc jsonb` (progress), `version` (compare-and-swap), `created_at`, `updated_at`, `resolved_at`. Index on `(player_id, case_id, created_at desc)`.

`doc` holds `evidence`, `findings` (`{ id, support }`: the subset that actually supports it), `confrontations`, `topics`, `leads`, `transcript` (`{ key, at }`, keyed by topic or confrontation id), `hints` (step → level), `accusation`. The server sets every timestamp; nothing is gated on time.

Store methods: `createRun`, `getRun`, `getLatestRun(playerId, caseId)`, `updateRun(id, fn)`, where `fn` returns `null` for "no change" (nothing written) and may throw `AppError` to abort.

## 4. Modules

```
lib/investigation/
  types.ts        CaseDefinition, Run, RunProgress, Requirement, Action
  rules.ts        pure: applyAction(def, run, action, now) → { run | null, outcome } or throws AppError
  view.ts         pure: project(def, run) → RunView; projectOutcome() → OutcomeView
  cases/refund.ts server-only: THE_REFUND_V1
  cases/index.ts  server-only: getCase, CURRENT_VERSION, allCases
  service.ts      server-only: requireRefund, canAccess, startRun, latestRun, getRunView, act (+ analytics)
  request.ts      server-only: readJson with a 4 KB body limit
app/api/investigations/route.ts                 GET latest run · POST start/resume/restart
app/api/investigations/[runId]/route.ts         GET projection
app/api/investigations/[runId]/actions/route.ts POST one action (zod discriminated union)
components/investigation/
  RefundCard.tsx  Home entry: Open the case / Continue / Review the case
  Investigation.tsx  shell: intro, tabs, sheets, notices, BackButton, active-time counter
  CaseDesk.tsx  People.tsx  Evidence.tsx  Compare.tsx  Timeline.tsx  Hints.tsx  Accusation.tsx
  Story.tsx  intro and ending      shared.tsx  Chip, Feedback, Avatar, Send type
```

How the rules work:

- **Requirements are small typed data** (`{ evidence?, findings?, confrontations?, topics? }`, all must hold), not a rules language. People, statements, topics, claims, challenges, hints, questions and Dex lines each carry one.
- **Findings**: a claim lists alternative support sets. Order and duplicates are ignored; a superset of known records is accepted and the matching subset is stored; undiscovered or unknown record ids are rejected with one generic message. A wrong or insufficient set returns the first matching feedback rule, or the claim's fallback. Compare, Timeline and the case desk all submit through this one check.
- **Confrontations** are challenges on a statement: claim + attached records/findings. C01 unlocks E04–E06 once; repeats replay without new transcript lines.
- **Accusation**: suspect + findings per slot (F01 / F02 / F03+F04). Wrong suspect → objection based only on what the player has established; missing proof → "Your theory needs more support." plus the first missing link. Only an accepted theory sets `resolved`; a retried winning accusation returns the same result.
- **Ending** paragraphs are filtered by the run: Lena's admissions appear only if C02/C03 happened, otherwise "Lena never admitted taking the money."
- **Timeline** order is checked on the client against times already visible (wrong order names the two conflicting times); a correct order submits F02 through the normal finding action. It disappears once F02 exists.
- **Leak guard**: client code imports only types from `view.ts`/`types.ts`. `cases/*` and `service.ts` import `server-only`. The production client bundle was scanned for hidden strings (RD-204, CS-88, creditor text): none found.

## 5. API

All routes: `route()` + `authenticate()`, then `requireRefund()` (flag off → 404 `NOT_AVAILABLE`), zod-validated bodies, ids capped at 40 chars and 12 per list.

| Route | Does |
| --- | --- |
| `GET /api/investigations?case=the-refund` | `{ run: { runId, status } \| null }`. Read-only. |
| `POST /api/investigations` `{ caseId, restart? }` | Returns the latest run (any status) or creates one; `restart: true` always creates a new, separate run. No charge of any kind. |
| `GET /api/investigations/[runId]` | `{ run: RunView }`. Never advances the story. Another player's run gives the same 404 as a missing one. |
| `POST /api/investigations/[runId]/actions` | `open_case`, `open_topic`, `follow_lead`, `submit_finding`, `confront`, `request_hint`, `accuse`, `evidence_opened` (analytics only). Returns `{ run, outcome }`. |

## 6. Analytics

`investigation_started`, `investigation_resumed`, `evidence_opened` (deduplicated per record per run in the browser), `finding_attempted`, `finding_established`, `confrontation_attempted`, `confrontation_resolved`, `hint_requested`, `accusation_submitted`, `investigation_completed`. Props are run/case/version and action ids, `ok`, hint level, counts; never dialogue or document text (a test checks this). `investigation_completed` fires only on the transition to `resolved`, with `activeMs` (visible-only time in that browser session, sent with `accuse`) separate from `wallMs`.

## 7. Extension points (not built)

- **Another case**: add `cases/<id>.ts`, register it in `cases/index.ts`, and give its interaction (grouping, tracing, source comparison, relationship links) its own small action type and validator in `rules.ts` or a sibling module. Extract shared parts only once a second case exists. `CaseDefinition` today is Refund-shaped; expect it to split when case 2 arrives.
- **Content changes**: add a new version beside the old one and bump `CURRENT_VERSION`. Existing runs keep their version.
- **Campaign progress**: a later table `campaign_progress (player_id, chapter_id, completed_at, run_id)`, unique on `(player_id, chapter_id)`, written idempotently in `service.act` when a run first resolves. Story order gates chapters; nothing infers completion from started runs.
- **Co-op**: access is one function, `canAccess(run, playerId)` in `service.ts`, which becomes room membership. The run doc is already the shared state; drafts are already client-only. Realtime would ping "run changed" and clients refetch through the API. Two-player confirmation and "continue alone in a personal copy" (fork the run) are future work.

## 8. Open questions for Endrit

1. **F03 accepts E02 + E07** in addition to the brief's E06 + E07 and E08 + E07. E07 itself says RD-204's destination is RELAY-72, and E02 shows the refund arriving at RELAY-72, so it is the same direct destination match as E08 + E07. Rejecting it felt unfair. It is one line in `cases/refund.ts` if you'd rather match the table exactly.
2. **Authored additions** beyond the brief's text, all consistent with §3: Mika's "Ask about the announcement" reply, Cedar's greeting, the "What this means" explainers on six records, decoy claims "Owen typed the wrong destination by mistake" and "Cedar Studio redirected the refund", decoy challenges "You chose RELAY-72 yourself" and "The community was never going to be paid", Dex's contextual lines, case-desk questions after F02, wrong-suspect objections, and the ending wording. Please read them in `cases/refund.ts`.
3. **Pressure line**: Lena's "I can pay extra" line is a topic ("Ask what she expects from the report") available after F01, rather than something she says unprompted.
