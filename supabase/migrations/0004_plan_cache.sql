-- Content-addressable cache of validated meal plans, keyed by a hash of the
-- deterministic constraint inputs (HARD_EXCLUDE/SOFT_AVOID/ALLOW/region/
-- budget/currency) sent to Claude. Lets two households with an identical
-- merged constraint profile reuse one Claude generation instead of paying
-- for it twice. Holds no personal data (no member names/emails) — only the
-- service role (the generate-plan Edge Function) ever touches this table.
create table if not exists public.plan_cache (
  constraint_hash text primary key,
  plan_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.plan_cache enable row level security;
-- No policies: only the service-role key (used server-side by the
-- generate-plan Edge Function) can read/write; it bypasses RLS entirely.
