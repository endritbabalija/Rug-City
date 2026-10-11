# 05 · Districts and cases in Postgres

## Goal

Cases live in the database with a district and a release time, and Home becomes a district map: Memecoin Swamp open, Sybil Square and DeFi Docks locked with one teaser each.

## Read first

- `Game Design v2.md` → Districts, Decisions (existing cases stay playable as previews)
- `DEFAULTS.md` → District unlocks
- `lib/cases/types.ts` (`CaseFile`), `lib/cases/index.ts`, `lib/cases/mooncat.ts`, `airdrop.ts`, `audit.ts`
- `lib/rooms.ts` (`requireCase`, `loadRoom`), `tests/cases.test.ts`
- `components/Home.tsx`, `components/GameContext.tsx` (`Screen`)

## Build

1. **`lib/cases/schema.ts`.** A zod schema matching `CaseFile`, plus `district`, `targetSec`, `preview?: boolean`. `CaseFile` type is inferred from or checked against it.
2. **Migration `0006_cases.sql`.** `cases (id text pk, district text, status text check in ('draft','review','live','retired'), release_at timestamptz null, version int, data jsonb, updated_at)`; index `(status, district, release_at)`.
3. **Case repository** in `lib/cases/index.ts`: `getCase(id)` (async) and `listCases()` return live cases with `release_at <= now`, from the database merged with the built-in TS cases (built-ins are used by the memory store and whenever the database has no row for that id). Validate with the schema on load; cache in memory by id and version. Update `requireCase` / `loadRoom` in `lib/rooms.ts` and every caller.
4. **Built-ins.** `mooncat-exit` → `memecoin-swamp`. `airdrop-of-doom` → `sybil-square`, `preview: true`. `audit-that-wasnt` → `defi-docks`, `preview: true`.
5. **`lib/districts.ts`.** `DISTRICTS` (id, name, crimes, skill, boss, `unlockRank`, order) for all six; `districtState(player, district)` → `open | locked | teaser`. Preview cases are playable even when their district is locked. Hosting and solo creation reject cases in locked districts unless `preview`.
6. **UI** behind flag `districts`: Home shows the district map; tapping an open district lists its cases as new or played (`hasPlayed`); locked districts show the rank needed and their teaser case. When a player has played every open case: "Next case drops on …" from the next future `release_at` (date only, no content).
7. **`/api/me`** returns districts and case summaries with their district and played state.

## Tests

- `tests/cases.test.ts` runs over every case from the repository.
- Every built-in passes the schema.
- `districtState` for each rank; teasers playable while locked; locked non-teaser cases rejected.
- A future `release_at` case is invisible and can't be hosted.

## Done when

- On a preview deploy, the map shows one open and two locked districts, and both teasers can be played.
- Done checks pass.

## Out of scope

- The pipeline and admin review (slice 6). Districts 4–6 content.
