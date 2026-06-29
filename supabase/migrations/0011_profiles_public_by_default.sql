-- Profiles are now public by default, like a typical social app — users
-- want to see who follows whom without an opt-in step. The app no longer
-- exposes a private toggle; this flips the column default and backfills
-- every existing row so nobody is invisible to followers/leaderboards.
-- Dietary/medical data was never on this table (see 0005), so this carries
-- no privacy regression for the household data that actually matters.

alter table public.profiles alter column is_public set default true;

update public.profiles set is_public = true where is_public = false;
