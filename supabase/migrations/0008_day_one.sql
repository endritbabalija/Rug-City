-- Day-one free cases (docs/phase-1/07-first-day.md): how many of DAY_ONE_FREE_CASES
-- (lib/player.ts) a player used on their signup UTC day. Add-only. Players created before
-- this slice signed up on an earlier day, so the column never applies to them.

alter table public.players
  add column if not exists day_one_used integer not null default 0;
