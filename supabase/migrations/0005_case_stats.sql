-- Per-case, per-mode play counts and solve times for scoring against a target time
-- (docs/phase-1/02-scoring-v2.md). A case is scored against its own targetSec until it has
-- MEDIAN_AFTER_PLAYS plays in a mode, then against median_sec, which a weekly job fills (slice 10).
-- target_sec and min_sec are left null for now.
-- Server-only (service role). RLS on, no policies.

create table if not exists public.case_stats (
  case_id     text        not null,
  mode        text        not null check (mode in ('solo', 'crew')),
  target_sec  integer,
  median_sec  integer,
  min_sec     integer,
  plays       integer     not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (case_id, mode)
);

alter table public.case_stats enable row level security;

-- One finished room of a case: insert the row on the first play, otherwise add one.
create or replace function public.bump_case_plays(p_case_id text, p_mode text)
returns void
language sql
set search_path = ''
as $$
  insert into public.case_stats (case_id, mode, plays, updated_at)
  values (p_case_id, p_mode, 1, now())
  on conflict (case_id, mode) do update
    set plays = public.case_stats.plays + 1, updated_at = now();
$$;

revoke execute on function public.bump_case_plays(text, text) from public, anon, authenticated;
grant execute on function public.bump_case_plays(text, text) to service_role;
