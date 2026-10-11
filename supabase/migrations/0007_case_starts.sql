-- A player who has seen a case's clues has played it (docs/phase-1/06b-fix-pass.md, F2).
-- One row per player per case, written for every human seat when the investigation begins,
-- so abandoning a case and replaying it later can't earn rated points. The first room wins;
-- later starts are no-ops. Playtest rooms record nothing.
-- Server-only (service role). RLS on, no policies.

create table if not exists public.case_starts (
  player_id  bigint      not null,
  case_id    text        not null,
  room_code  text        not null,
  at         timestamptz not null default now(),
  primary key (player_id, case_id)
);

alter table public.case_starts enable row level security;
