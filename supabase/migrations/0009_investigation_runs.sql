-- Investigation runs (docs/architecture.md): one player's progress through one authored
-- case, pinned to the case version it started on. `doc` holds the progress (ids of
-- discovered evidence, findings, confrontations, transcript events, hint levels).
-- Versioned with compare-and-swap like `players`. Add-only; RLS on with no policies,
-- so only the server (secret key) can read or write.

create table if not exists public.investigation_runs (
  id            uuid primary key,
  player_id     bigint  not null,
  case_id       text    not null,
  case_version  integer not null,
  status        text    not null check (status in ('intro', 'investigating', 'resolved')),
  doc           jsonb   not null,
  version       integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists investigation_runs_player_idx
  on public.investigation_runs (player_id, case_id, created_at desc);

alter table public.investigation_runs enable row level security;
