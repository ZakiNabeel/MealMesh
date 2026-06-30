-- Engine integration (local deterministic engine, no LLM at runtime).
--
-- Three changes, all additive and idempotent:
--   1. households.cuisines  — persist the multi-cuisine mix (CuisineWeight[]),
--      so a "80% south_asian + 20% chinese" household survives a reload instead
--      of collapsing back to the single region_preference.
--   2. region_preference check — widen to the full TS `Region` enum. The
--      original 0001 check allowed only 7 values; the app now offers
--      'chinese', 'american', 'european' too, and saving them must not fail.
--   3. recipe_corpus enrichment columns + a filtered read index — provenance
--      and confidence for rows ingested from external datasets (Kaggle, etc.),
--      so the fetch layer can trust only well-tagged rows.

/* ----------------------------------------------------------------- */
/* 1. households.cuisines                                             */
/* ----------------------------------------------------------------- */
alter table public.households
  add column if not exists cuisines jsonb not null default '[]'::jsonb;

/* ----------------------------------------------------------------- */
/* 2. Widen region_preference to the full Region enum                */
/* ----------------------------------------------------------------- */
alter table public.households
  drop constraint if exists households_region_preference_check;

alter table public.households
  add constraint households_region_preference_check
  check (region_preference in (
    'south_asian','middle_eastern','mediterranean','east_asian',
    'chinese','latin','african','american','european','none'
  ));

/* ----------------------------------------------------------------- */
/* 3. recipe_corpus enrichment metadata                              */
/* ----------------------------------------------------------------- */
alter table public.recipe_corpus
  -- 0..100 confidence in the cuisine tag. Seed/original rows are certain (100);
  -- external rows get the enrichment pipeline's score and we only read >= 80.
  add column if not exists cuisine_confidence smallint not null default 100,
  -- How the cuisine was assigned, for auditing/retagging:
  -- 'original' | 'national_dish' | 'title_rule' | 'ingredient_fp' | 'classifier'
  add column if not exists cuisine_tag_method text not null default 'original',
  -- Which dataset a row came from, e.g. 'mealmesh_seed', 'kaggle_2m'.
  add column if not exists source_dataset text not null default 'mealmesh_seed';

alter table public.recipe_corpus
  drop constraint if exists recipe_corpus_cuisine_confidence_chk;
alter table public.recipe_corpus
  add constraint recipe_corpus_cuisine_confidence_chk
  check (cuisine_confidence between 0 and 100);

-- The weekly selector reads by (cuisine, course) filtered to confident rows,
-- best-first. This composite index serves that hot path.
create index if not exists recipe_corpus_cuisine_course_conf
  on public.recipe_corpus (cuisine, course, cuisine_confidence desc);

-- Idempotent seed/ingest: a dish is unique by (title, cuisine, course). Plain
-- columns (not lower(title)) so PostgREST upsert can target it via onConflict;
-- the ingest pipeline normalizes title casing/whitespace before writing, so
-- case-variant duplicates are collapsed upstream.
create unique index if not exists recipe_corpus_title_cuisine_course_uq
  on public.recipe_corpus (title, cuisine, course);
