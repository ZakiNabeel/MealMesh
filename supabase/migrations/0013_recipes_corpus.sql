-- The local recipe corpus — the data layer for MealMesh's own deterministic
-- meal-planning engine (no external LLM at runtime). Each recipe is tagged at
-- INGEST time, by the SAME constraint lexicon the app uses (src/lib/constraints
-- analyzeIngredient + dietLibrary DIET_DEFINITIONS), so the runtime safety
-- filter is a pure, exact array-overlap test — never a guess, never a model
-- call.
--
-- SAFETY MODEL: a recipe is safe for a household iff
--   exclusion_tokens && household_HARD_EXCLUDE  ==  '{}'  (no overlap).
-- `exclusion_tokens` is the union of every allergen/diet token any of the
-- recipe's ingredients carry. The GIN index makes the overlap test fast at
-- corpus scale.

create table if not exists public.recipes (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  cuisine         text not null,                       -- Region enum value (south_asian, chinese, …)
  country_origin  text,                                -- ISO code, nullable — disambiguates a broad region (PK vs IN)
  course          text not null,                       -- breakfast|lunch|supper|dinner|dessert|appetizer|drink|main
  ingredients     jsonb not null,                      -- [{ name, quantity, unit, canonical }]
  steps           jsonb not null default '[]'::jsonb,
  servings        int  not null default 4,
  time_minutes    int  not null default 30,
  -- DERIVED at ingest by the constraint lexicon (do not hand-edit):
  exclusion_tokens text[]   not null default '{}',     -- safety: every allergen/diet token present
  diet_compatible  text[]   not null default '{}',     -- constraint keys this recipe satisfies (UI/browsing)
  cost_tier        smallint not null default 2,        -- 1 cheap .. 3 premium (budget fit)
  health_score     smallint not null default 3,        -- 1 indulgent .. 5 lean (health-consciousness fit)
  -- Provenance — required so we can honour licences (e.g. CC-BY-SA attribution):
  source           text,
  license          text,                               -- 'original' | 'CC-BY-SA-3.0' | …
  attribution_url  text,
  created_at       timestamptz not null default now(),
  constraint recipes_cost_tier_chk    check (cost_tier between 1 and 3),
  constraint recipes_health_score_chk check (health_score between 1 and 5)
);

-- The safety hot-path: `WHERE NOT exclusion_tokens && :hard_exclude`.
create index if not exists recipes_exclusion_gin on public.recipes using gin (exclusion_tokens);
-- Cuisine + course narrowing for the weekly selector.
create index if not exists recipes_cuisine_course on public.recipes (cuisine, course);

-- Public read (the corpus is shared, non-sensitive reference data). No insert/
-- update/delete policies are defined, so ONLY the service role (which bypasses
-- RLS) can write — i.e. the offline ingest pipeline, never a client.
alter table public.recipes enable row level security;

drop policy if exists "recipes are publicly readable" on public.recipes;
create policy "recipes are publicly readable" on public.recipes for select using (true);
