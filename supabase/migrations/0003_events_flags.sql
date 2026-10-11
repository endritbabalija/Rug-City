-- Product events and feature flags.
-- events: append-only, written by the server through lib/analytics.ts. Gate views read it.
-- feature_flags: one row per flag; a missing row means off. Set by hand per environment.
-- Both are server-only (service role). RLS on, no policies.

create table if not exists public.events (
  id         bigserial   primary key,
  name       text        not null,
  player_id  bigint,
  props      jsonb       not null default '{}',
  at         timestamptz not null default now()
);
create index if not exists events_name_at_idx on public.events (name, at);
create index if not exists events_player_at_idx on public.events (player_id, at);

create table if not exists public.feature_flags (
  name        text    primary key,
  enabled     boolean not null default false,
  note        text,
  updated_at  timestamptz
);

alter table public.events enable row level security;
alter table public.feature_flags enable row level security;
