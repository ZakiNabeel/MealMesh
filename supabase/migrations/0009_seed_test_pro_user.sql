-- Testing-phase convenience: grant the founder's own account Pro by default so
-- Pro-only UI (checkmark badge, Crew creation, higher daily post limit, etc.)
-- can be exercised without a real Freemius purchase. Idempotent — safe to
-- re-run, and a no-op if the account doesn't exist yet.

alter table public.subscription_status drop constraint if exists subscription_status_source_check;
alter table public.subscription_status add constraint subscription_status_source_check
  check (source in ('freemius', 'revenuecat', 'manual'));

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'zakinabeelalu@gmail.com';
  if v_user_id is not null then
    insert into public.subscription_status (user_id, tier, source)
    values (v_user_id, 'pro', 'manual')
    on conflict (user_id) do update set tier = 'pro', source = 'manual';

    update public.profiles set is_pro = true where user_id = v_user_id;
  end if;
end $$;
