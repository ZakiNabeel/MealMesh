/**
 * Seed the Supabase `recipe_corpus` table with MealMesh's hand-authored seed
 * recipes (the same RAW list the app ships in src/lib/corpus.ts).
 *
 * Run OFFLINE, manually, with the SERVICE ROLE key (never shipped to clients):
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   npm run seed-corpus
 *
 * Idempotent: upserts on the (title, cuisine, course) unique index (migration
 * 0014), so re-running refreshes rows in place instead of duplicating them.
 * Safety tags are computed here by tagRecipe() — the SAME lexicon the app
 * enforces with — so the DB never stores a hand-declared exclusion set.
 */

import { createClient } from '@supabase/supabase-js';

import { RAW } from '@/lib/corpus';
import { tagRecipe, type TaggedRecipe } from '@/lib/recipeCorpus';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    'Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running. ' +
      'The service-role key bypasses RLS — keep it out of the repo and the client.',
  );
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Map a TaggedRecipe to a `recipe_corpus` row. Seed rows are certain (100). */
function toRow(r: TaggedRecipe) {
  return {
    title: r.title,
    cuisine: r.cuisine,
    country_origin: r.countryOrigin ?? null,
    course: r.course,
    ingredients: r.ingredients,
    steps: r.steps,
    servings: r.servings ?? 4,
    time_minutes: r.timeMinutes ?? 30,
    exclusion_tokens: r.exclusionTokens,
    diet_compatible: r.dietCompatible,
    cost_tier: r.costTier,
    health_score: r.healthScore,
    source: r.source ?? 'MealMesh original',
    license: r.license ?? 'original',
    attribution_url: r.attributionUrl ?? null,
    cuisine_confidence: 100,
    cuisine_tag_method: 'original',
    source_dataset: 'mealmesh_seed',
  };
}

async function main() {
  const rows = RAW.map(tagRecipe).map(toRow);
  console.log(`Seeding ${rows.length} recipes into recipe_corpus…`);

  // Chunk to stay well under any request-size limit.
  const CHUNK = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('recipe_corpus')
      .upsert(batch, { onConflict: 'title,cuisine,course' });
    if (error) {
      console.error('Upsert failed:', error.message);
      process.exit(1);
    }
    written += batch.length;
  }

  console.log(`✓ Seeded ${written} recipes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
