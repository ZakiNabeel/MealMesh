-- SECURITY FIX: stop users from granting themselves the Pro flair.
--
-- `profiles.is_pro` is a denormalized, PUBLIC-readable copy of a user's paid
-- status (subscription_status is owner-private, so the leaderboard reads is_pro
-- to show a Pro badge on other people's rows). It is meant to be written ONLY
-- by the Freemius webhook (service role).
--
-- The bug: the `profiles_update_own` RLS policy authorizes a user to UPDATE
-- their own row, and Postgres row-level security is not column-level — so a
-- signed-in user could run, straight from the browser console:
--
--     supabase.from('profiles').update({ is_pro: true }).eq('user_id', myId)
--
-- ...and award themselves the Pro badge. (Real Pro entitlements — crew creation,
-- plan gating — check subscription_status.tier, which stays server-only, so this
-- was a spoofed badge rather than free paid features. We still close it.)
--
-- Fix: a BEFORE INSERT/UPDATE trigger that pins is_pro to its previous value for
-- the two client-facing roles (authenticated, anon). The service role (webhook)
-- and direct SQL/migrations (postgres, no JWT) are unaffected, so legitimate
-- grants still work. This is column-addition-proof and needs no privilege
-- bookkeeping as the profiles table grows.

-- 1. Re-sync is_pro from the source of truth FIRST (before the trigger exists),
--    undoing any self-granted badges already sitting in the table.
update public.profiles p
set is_pro = exists (
  select 1 from public.subscription_status s
  where s.user_id = p.user_id and s.tier = 'pro'
)
where p.is_pro is distinct from exists (
  select 1 from public.subscription_status s
  where s.user_id = p.user_id and s.tier = 'pro'
);

-- 2. The guard. Only 'authenticated'/'anon' (PostgREST client roles) are pinned;
--    everything else (service_role, postgres) may write is_pro freely.
create or replace function public.protect_profile_is_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = any (array['authenticated', 'anon']) then
    if tg_op = 'INSERT' then
      new.is_pro := false;              -- new users are never Pro on day one
    else
      new.is_pro := old.is_pro;         -- clients cannot change their own flag
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_pro on public.profiles;
create trigger profiles_protect_is_pro
  before insert or update on public.profiles
  for each row execute function public.protect_profile_is_pro();
