-- Player progress in typed tables (Architecture.md, decision B).
-- players gets one column per field of the old doc; badges, season rewards, finished cases
-- and suspect chats get their own tables; seasons get dates instead of fixed-length math.
-- Filled from players.doc by scripts/backfill-v2.mjs. doc stays (nullable) for one release
-- because the code on main still reads it; a later migration drops it.
-- Server-only (service role). RLS on, no policies.

alter table public.players
  add column if not exists name             text,
  add column if not exists username         text,
  add column if not exists photo_url        text,
  add column if not exists case_credits     integer not null default 0,
  add column if not exists subpoena         integer not null default 0,
  add column if not exists trace            integer not null default 0,
  add column if not exists hint             integer not null default 0,
  add column if not exists free_case_day    date,
  add column if not exists referred_by      bigint,
  add column if not exists referral_settled boolean not null default false,
  add column if not exists active_badge     text,
  add column if not exists clue_points      integer not null default 0,
  add column if not exists streak_days      integer not null default 0,
  add column if not exists last_rated_day   date,
  add column if not exists rated_day        date,
  add column if not exists rated_count      integer not null default 0,
  -- md5 of the doc the backfill last copied, so re-running it never overwrites newer column writes.
  add column if not exists backfilled_doc   text;
alter table public.players alter column doc drop not null;

create table if not exists public.player_badges (
  player_id  bigint      not null,
  badge      text        not null,
  at         timestamptz not null default now(),
  primary key (player_id, badge)
);

-- One row per season whose end-of-season rewards a player already got.
create table if not exists public.season_rewards (
  season     integer     not null,
  player_id  bigint      not null,
  at         timestamptz not null default now(),
  primary key (season, player_id)
);

-- One row per player per finished room. Inserted once when the room settles; the unique key
-- makes a second settle a no-op. Backfilled rows use room codes `legacy-…` and mode 'legacy'
-- (real codes are 5 characters, A-Z 0-9).
create table if not exists public.case_results (
  id           bigserial   primary key,
  room_code    text        not null,
  player_id    bigint      not null,
  case_id      text        not null,
  mode         text        not null,
  seats        integer     not null,
  correct      integer     not null,
  score        integer     not null,
  points       jsonb       not null,
  total        integer     not null,
  rating       integer,               -- counted toward the season rating; null if not
  elapsed_sec  integer,
  unrated      text,                  -- why it earned nothing; null if rated
  at           timestamptz not null default now(),
  unique (room_code, player_id)
);
create index if not exists case_results_player_case_idx on public.case_results (player_id, case_id);
create index if not exists case_results_player_at_idx on public.case_results (player_id, at desc);
create index if not exists case_results_case_mode_idx on public.case_results (case_id, mode);

create table if not exists public.seasons (
  id         integer     primary key check (id > 0),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at)
);
-- docs/phase-1/DEFAULTS.md: three 4-week seasons, then 8 weeks each from S4.
-- Same list as SEASON_SEED in lib/store/memory.ts. Past the last row, seasons keep the last length.
insert into public.seasons (id, starts_at, ends_at) values
  (1, '2026-10-05T00:00:00Z', '2026-11-02T00:00:00Z'),
  (2, '2026-11-02T00:00:00Z', '2026-11-30T00:00:00Z'),
  (3, '2026-11-30T00:00:00Z', '2026-12-28T00:00:00Z'),
  (4, '2026-12-28T00:00:00Z', '2027-02-22T00:00:00Z'),
  (5, '2027-02-22T00:00:00Z', '2027-04-19T00:00:00Z'),
  (6, '2027-04-19T00:00:00Z', '2027-06-14T00:00:00Z'),
  (7, '2027-06-14T00:00:00Z', '2027-08-09T00:00:00Z'),
  (8, '2027-08-09T00:00:00Z', '2027-10-04T00:00:00Z')
on conflict (id) do nothing;

-- Private suspect chats, one row per message. seq counts from 0 per (room, player, suspect).
create table if not exists public.room_chats (
  room_code  text        not null,
  player_id  bigint      not null,
  suspect_id text        not null,
  seq        integer     not null,
  sender     text        not null check (sender in ('player', 'suspect')),
  text       text        not null,
  subpoena   boolean     not null default false,
  at         timestamptz not null default now(),
  primary key (room_code, player_id, suspect_id, seq)
);

alter table public.player_badges  enable row level security;
alter table public.season_rewards enable row level security;
alter table public.case_results   enable row level security;
alter table public.seasons        enable row level security;
alter table public.room_chats     enable row level security;
