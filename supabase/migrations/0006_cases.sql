-- Cases in Postgres (docs/phase-1/05-districts.md). A case is playable when its status is
-- 'live' and its release_at (if any) has passed. `data` is the CaseFile JSON, checked against
-- lib/cases/schema.ts when it loads; `version` goes up on every edit so servers re-read it.
-- Ids with no row here fall back to the built-in cases in lib/cases/*.ts.
-- Server-only (service role). RLS on, no policies.

create table if not exists public.cases (
  id          text        primary key,
  district    text        not null,
  status      text        not null default 'draft' check (status in ('draft', 'review', 'live', 'retired')),
  release_at  timestamptz,
  version     integer     not null default 1,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

create index if not exists cases_status_district_release_idx on public.cases (status, district, release_at);

alter table public.cases enable row level security;
