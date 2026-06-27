-- Fix: crew_members' own SELECT policy subqueried crew_members itself
-- ("crew_id in (select crew_id from crew_members where user_id = ...)"),
-- and Postgres re-applies a table's RLS policy on every reference to that
-- table — including from inside its own policy. That self-reference recurses
-- forever, surfacing as "infinite recursion detected in policy for relation
-- crew_members" on ANY read of crews/crew_members/user_stats (confirmed via
-- an anon-key audit immediately after migration 0006).
--
-- Fix: route the "what's my crew?" lookup through a SECURITY DEFINER
-- function. It runs as the table owner, which bypasses RLS for its own
-- internal query, breaking the cycle.

create or replace function public.my_crew_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select crew_id from public.crew_members where user_id = auth.uid() limit 1;
$$;

drop policy if exists crew_members_read on public.crew_members;
create policy crew_members_read on public.crew_members
  for select
  using (
    user_id = auth.uid()
    or crew_id = public.my_crew_id()
  );

drop policy if exists crews_read on public.crews;
create policy crews_read on public.crews
  for select
  using (
    owner_id = auth.uid()
    or id = public.my_crew_id()
  );
