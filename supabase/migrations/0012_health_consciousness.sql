-- Household-level health-consciousness scale (1-5), set during onboarding.
-- Factored into plan generation (Gemini prompt + the local fallback engine)
-- to moderate sugar/oil/fried-food usage and lean on lighter dishes as it
-- rises. Defaults to 3 (moderate) so existing households are unaffected.

alter table public.households
  add column if not exists health_consciousness smallint not null default 3
    check (health_consciousness between 1 and 5);
