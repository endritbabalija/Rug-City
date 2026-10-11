-- Remove the crew game's storage (the game was removed from the code on 2026-10-11, PR #12).
-- Nothing on `main` reads any of this: the code uses players (id, name, username, photo_url,
-- created_at, updated_at, version), events, feature_flags and investigation_runs only.
-- This is the deliberate removal migration docs/ops/environments.md asks for. It deletes
-- data; Endrit approved it without a backup, and it was applied on 2026-10-12. Safe to run twice.

drop function if exists public.bump_case_plays(text, text);

drop table if exists public.room_chats;
drop table if exists public.rooms;
drop table if exists public.purchases;
drop table if exists public.case_results;
drop table if exists public.case_starts;
drop table if exists public.case_stats;
drop table if exists public.cases;
drop table if exists public.player_badges;
drop table if exists public.season_ratings;
drop table if exists public.season_rewards;
drop table if exists public.seasons;

alter table public.players
  drop column if exists doc,
  drop column if exists backfilled_doc,
  drop column if exists case_credits,
  drop column if exists subpoena,
  drop column if exists trace,
  drop column if exists hint,
  drop column if exists free_case_day,
  drop column if exists day_one_used,
  drop column if exists referred_by,
  drop column if exists referral_settled,
  drop column if exists active_badge,
  drop column if exists clue_points,
  drop column if exists streak_days,
  drop column if exists last_rated_day,
  drop column if exists rated_day,
  drop column if exists rated_count;

-- Flag rows only the crew game read.
delete from public.feature_flags where name in ('solo', 'dex_crew');
