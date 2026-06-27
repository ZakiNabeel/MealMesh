-- Milestone 2: social graph (follows), cached leaderboard stats (user_stats),
-- and the Pro "Crews" perk (private group leaderboards).
--
-- user_stats is a CACHE only — the source of truth is still meal_logs, scored
-- by the pure src/lib/gamification.ts engine. The client recomputes
-- lifetimeStats() after every log/unlog and upserts the result here, so the
-- leaderboard can rank by a single indexed table instead of scanning every
-- user's raw logs. If the cache and the logs ever disagree, the logs win.

-- Denormalized Pro flag on profiles: subscription_status is strictly
-- owner-private (a user can only read their own row), but the leaderboard
-- needs to show a Pro flair on OTHER users' rows. Kept in sync by the
-- Freemius webhook whenever it flips subscription_status.
alter table public.profiles add column if not exists is_pro boolean not null default false;

-- ===========================================================================
-- follows — a public social graph
-- ===========================================================================

create table if not exists public.follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select
  using (true);

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows
  for insert
  with check (follower_id = auth.uid());

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows
  for delete
  using (follower_id = auth.uid());

-- ===========================================================================
-- user_stats — cached gamification totals (one row per user)
-- ===========================================================================

create table if not exists public.user_stats (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  total_points     int not null default 0,
  current_streak   int not null default 0,
  longest_streak   int not null default 0,
  meals_logged     int not null default 0,
  clean_plate_days int not null default 0,
  perfect_weeks    int not null default 0,
  updated_at       timestamptz not null default now()
);

create index if not exists user_stats_points_idx on public.user_stats (total_points desc);

alter table public.user_stats enable row level security;

drop policy if exists user_stats_insert_own on public.user_stats;
create policy user_stats_insert_own on public.user_stats
  for insert
  with check (user_id = auth.uid());

drop policy if exists user_stats_update_own on public.user_stats;
create policy user_stats_update_own on public.user_stats
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- crews — Pro perk: small private groups with their own leaderboard
-- ===========================================================================

create table if not exists public.crews (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- One crew per person (like a household) — keeps "switch crews" unambiguous
-- and means join_crew() never has to silently merge two memberships.
create table if not exists public.crew_members (
  crew_id   uuid not null references public.crews (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade unique,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

-- Crews/crew_members are readable only by their own members — unlike follows,
-- invite_code is a shared secret, so we never expose it via a public select
-- (joining goes through the join_crew() function below instead).
drop policy if exists crews_read on public.crews;
create policy crews_read on public.crews
  for select
  using (
    owner_id = auth.uid()
    or id in (select crew_id from public.crew_members where user_id = auth.uid())
  );

drop policy if exists crews_insert_pro on public.crews;
create policy crews_insert_pro on public.crews
  for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.subscription_status s
      where s.user_id = auth.uid() and s.tier = 'pro'
    )
  );

drop policy if exists crew_members_read on public.crew_members;
create policy crew_members_read on public.crew_members
  for select
  using (
    user_id = auth.uid()
    or crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
  );

drop policy if exists crew_members_delete_own on public.crew_members;
create policy crew_members_delete_own on public.crew_members
  for delete
  using (user_id = auth.uid());

-- Owner is auto-joined as a member when a crew is created.
drop policy if exists crew_members_insert_owner on public.crew_members;
create policy crew_members_insert_owner on public.crew_members
  for insert
  with check (
    user_id = auth.uid()
    and crew_id in (select id from public.crews where owner_id = auth.uid())
  );

-- Look up + join a crew by invite code in one SECURITY DEFINER call, so the
-- code itself never needs to be select-able from the client.
create or replace function public.join_crew(p_invite_code text)
returns table (crew_id uuid, crew_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew_id uuid;
  v_crew_name text;
begin
  if exists (select 1 from public.crew_members where user_id = auth.uid()) then
    raise exception 'You are already in a crew — leave it first.';
  end if;

  select id, name into v_crew_id, v_crew_name
  from public.crews where invite_code = p_invite_code;

  if v_crew_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.crew_members (crew_id, user_id)
  values (v_crew_id, auth.uid());

  return query select v_crew_id, v_crew_name;
end;
$$;

-- ===========================================================================
-- Crewmates may see each other even when not globally public — a Crew is a
-- closed group, not the open leaderboard, so it's a deliberate exception to
-- the "public only" rule (still carries zero dietary/medical data).
-- ===========================================================================

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select
  using (
    is_public
    or user_id = auth.uid()
    or exists (
      select 1 from public.crew_members cm1
      join public.crew_members cm2 on cm1.crew_id = cm2.crew_id
      where cm1.user_id = auth.uid() and cm2.user_id = profiles.user_id
    )
  );

drop policy if exists user_stats_read on public.user_stats;
create policy user_stats_read on public.user_stats
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.user_id = user_stats.user_id and p.is_public)
    or exists (
      select 1 from public.crew_members cm1
      join public.crew_members cm2 on cm1.crew_id = cm2.crew_id
      where cm1.user_id = auth.uid() and cm2.user_id = user_stats.user_id
    )
  );
