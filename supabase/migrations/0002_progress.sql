-- Season leaderboard. Clue Points and per-player progress live in players.doc;
-- this table only exists so the leaderboard can be sorted and counted in SQL.
-- Written by the server (service role) after each rated case. RLS on, no policies.

create table if not exists public.season_ratings (
  season      integer not null check (season > 0),
  player_id   bigint  not null,
  name        text    not null,
  badge       text,
  rating      integer not null default 0 check (rating >= 0),
  cases       integer not null default 0 check (cases >= 0),
  updated_at  timestamptz not null default now(),  -- when the rating was reached; breaks ties
  primary key (season, player_id)
);
create index if not exists season_ratings_rank_idx on public.season_ratings (season, rating desc, updated_at asc);

alter table public.season_ratings enable row level security;
