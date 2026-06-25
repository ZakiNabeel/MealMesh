-- Optional weekly grocery budget (in the household's local currency).
alter table public.households add column if not exists budget_weekly numeric;
