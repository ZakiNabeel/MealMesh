-- MealMesh initial schema (context doc §3).
--
-- Apply with either:
--   supabase db push           (if you use the Supabase CLI + linked project)
--   or paste into Dashboard → SQL Editor and run.
--
-- Every table has Row Level Security ON: a user can only touch rows tied to
-- their own auth.uid(). Multi-profile households exist from day one — there is
-- no single-user shortcut to retrofit later.

-- ===========================================================================
-- Tables
-- ===========================================================================

create table if not exists public.households (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  region_preference text not null default 'none'
                      check (region_preference in (
                        'south_asian','middle_eastern','mediterranean',
                        'east_asian','latin','african','none')),
  created_at        timestamptz not null default now()
);

create table if not exists public.members (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  name           text not null,
  age_band       text not null default 'adult'
                   check (age_band in ('child','teen','adult')),
  calorie_target int
);

create table if not exists public.member_constraints (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members (id) on delete cascade,
  constraint_key text not null,          -- mirrors ConstraintKey in src/types
  type           text not null
                   check (type in ('religious','lifestyle','medical','allergen')),
  severity       text not null
                   check (severity in ('hard','soft')),
  unique (member_id, constraint_key)
);

create table if not exists public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start   date not null,
  plan_json    jsonb not null,
  grocery_json jsonb not null,
  created_at   timestamptz not null default now(),
  unique (household_id, week_start)
);

create table if not exists public.subscription_status (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  tier               text not null default 'free' check (tier in ('free','pro')),
  source             text check (source in ('freemius','revenuecat')),
  current_period_end timestamptz
);

-- Helpful indexes for the ownership lookups RLS performs.
create index if not exists households_owner_idx        on public.households (owner_user_id);
create index if not exists members_household_idx        on public.members (household_id);
create index if not exists member_constraints_member_idx on public.member_constraints (member_id);
create index if not exists meal_plans_household_week_idx  on public.meal_plans (household_id, week_start);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.households          enable row level security;
alter table public.members             enable row level security;
alter table public.member_constraints  enable row level security;
alter table public.meal_plans          enable row level security;
alter table public.subscription_status enable row level security;

-- households: the owner is the user.
drop policy if exists households_owner_all on public.households;
create policy households_owner_all on public.households
  for all
  using      (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- members: owned transitively through the household.
drop policy if exists members_owner_all on public.members;
create policy members_owner_all on public.members
  for all
  using (
    household_id in (select id from public.households where owner_user_id = auth.uid())
  )
  with check (
    household_id in (select id from public.households where owner_user_id = auth.uid())
  );

-- member_constraints: owned through member -> household.
drop policy if exists member_constraints_owner_all on public.member_constraints;
create policy member_constraints_owner_all on public.member_constraints
  for all
  using (
    member_id in (
      select m.id from public.members m
      join public.households h on h.id = m.household_id
      where h.owner_user_id = auth.uid()
    )
  )
  with check (
    member_id in (
      select m.id from public.members m
      join public.households h on h.id = m.household_id
      where h.owner_user_id = auth.uid()
    )
  );

-- meal_plans: owned through the household. (Writes normally happen via the Edge
-- Function using the service role, which bypasses RLS; this lets the owner read
-- and, if needed, manage their own plans directly.)
drop policy if exists meal_plans_owner_all on public.meal_plans;
create policy meal_plans_owner_all on public.meal_plans
  for all
  using (
    household_id in (select id from public.households where owner_user_id = auth.uid())
  )
  with check (
    household_id in (select id from public.households where owner_user_id = auth.uid())
  );

-- subscription_status: a user may READ only their own row. Writes are
-- server-only (payment webhooks via service role), so no user insert/update.
drop policy if exists subscription_status_select_own on public.subscription_status;
create policy subscription_status_select_own on public.subscription_status
  for select
  using (user_id = auth.uid());

-- ===========================================================================
-- Auto-provision a free tier for every new user
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
