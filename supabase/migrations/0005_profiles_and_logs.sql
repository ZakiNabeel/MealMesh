-- Milestone 1: public identity (profiles) + cooking logs (meal_logs) + Storage.
--
-- This is the first time MealMesh exposes ANY public-readable data. The privacy
-- firewall (context doc §10) is enforced structurally:
--   * profiles carry NO dietary/medical constraints — only a chosen username,
--     avatar and bio — and are invisible (is_public = false) until the user
--     opts in.
--   * meal_logs stay owner-private here; only a constraint-free projection is
--     ever exposed publicly (added with the feed in a later milestone).
-- The existing owner-private tables (households, members, member_constraints,
-- meal_plans) are left exactly as they are.

-- ===========================================================================
-- profiles — the public identity keystone (one row per auth user)
-- ===========================================================================

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
                 check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_url   text,
  bio          text,
  is_public    boolean not null default false,   -- opt-in; private by default
  region       text,                              -- optional, for regional boards
  created_at   timestamptz not null default now()
);

create index if not exists profiles_public_idx on public.profiles (is_public);

-- Derive a unique, URL-safe username from an email local-part, with a short
-- random suffix and a collision-avoidance loop. SECURITY DEFINER so it can be
-- called from the signup trigger and the backfill below.
create or replace function public.generate_username(seed_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  base := lower(regexp_replace(split_part(coalesce(seed_email, 'chef'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base) < 3 then base := base || 'chef'; end if;
  base := substr(base, 1, 14);
  loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
    exit when not exists (select 1 from public.profiles where username = candidate);
  end loop;
  return candidate;
end;
$$;

-- ===========================================================================
-- meal_logs — "I cooked this" records, keyed by PLAN COORDINATES
-- ===========================================================================
-- Tied to user_id (stable), NOT household_id, so editing/replacing a household
-- never wipes cooking history. Plans are opaque JSONB, so the (week, day, slot)
-- triple is how a log points back at a specific meal.

create table if not exists public.meal_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  week_start   date not null,
  day_of_week  text not null
                 check (day_of_week in
                   ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  slot         text not null
                 check (slot in ('breakfast','lunch','supper','dinner')),
  meal_name    text not null default '',
  photo_url    text,
  caption      text,
  created_at   timestamptz not null default now(),
  unique (user_id, week_start, day_of_week, slot)
);

create index if not exists meal_logs_user_idx on public.meal_logs (user_id, week_start);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.profiles  enable row level security;
alter table public.meal_logs enable row level security;

-- profiles: world-readable ONLY when public; always readable by the owner.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select
  using (is_public or user_id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert
  with check (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- meal_logs: strictly owner-private for now (a public, constraint-free view is
-- introduced alongside the community feed in a later milestone).
drop policy if exists meal_logs_owner_all on public.meal_logs;
create policy meal_logs_owner_all on public.meal_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Auto-provision a profile for every new user (extends the existing trigger)
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscription_status (user_id, tier)
  values (new.id, 'free')
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, username, display_name)
  values (
    new.id,
    public.generate_username(new.email),
    coalesce(split_part(new.email, '@', 1), 'Chef')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill a profile for every existing user that doesn't have one yet.
insert into public.profiles (user_id, username, display_name)
select u.id, public.generate_username(u.email), coalesce(split_part(u.email, '@', 1), 'Chef')
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

-- ===========================================================================
-- Storage buckets (first use of Supabase Storage)
-- ===========================================================================
-- Public-read buckets; writes are restricted to each user's own top-level
-- folder (the first path segment must equal their auth uid).

insert into storage.buckets (id, name, public)
values
  ('avatars',     'avatars',     true),
  ('meal-photos', 'meal-photos', true),
  ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select
  using (bucket_id in ('avatars', 'meal-photos', 'post-images'));

drop policy if exists storage_own_folder_insert on storage.objects;
create policy storage_own_folder_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'meal-photos', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_own_folder_update on storage.objects;
create policy storage_own_folder_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'meal-photos', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_own_folder_delete on storage.objects;
create policy storage_own_folder_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'meal-photos', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
