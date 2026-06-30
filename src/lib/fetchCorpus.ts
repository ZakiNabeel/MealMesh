/**
 * The corpus FETCH layer — decides where the engine's recipe pool comes from for
 * a given household, with a guaranteed safe fallback.
 *
 *   - Supabase configured + reachable + has confident rows for the household's
 *     cuisines  → use the DB corpus (`recipe_corpus`), which can scale to
 *     thousands of ingested dishes.
 *   - Otherwise (not configured, offline, query error, or zero rows)
 *     → fall back to the in-memory seed corpus (`getCorpus()`), so generation
 *     ALWAYS works — offline, signed-out, or before the DB is seeded.
 *
 * Safety is never delegated to the DB: every fetched row is re-checked with
 * `isRecipeSafe` against the household's HARD_EXCLUDE here on the client, so a
 * mis-tagged or stale row can only ever shrink the pool, never leak a forbidden
 * ingredient into a plan.
 */

import { getCorpus } from '@/lib/corpus';
import { normalizeCuisineMix, regionsInMix } from '@/lib/cuisineMix';
import {
  fromDbRow,
  householdHardExclude,
  isRecipeSafe,
  type CorpusRow,
  type TaggedRecipe,
} from '@/lib/recipeCorpus';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Household } from '@/types';

/** Only rows we trust the cuisine tag of (seed/original rows are 100). */
const MIN_CONFIDENCE = 80;

/** Session memo so regenerating a plan doesn't refetch the same pool. */
const cache = new Map<string, TaggedRecipe[]>();

/** Cache key: the cuisines that drive the query + the safety set that filters it. */
function cacheKey(household: Household): string {
  const regions = regionsInMix(normalizeCuisineMix(household.region, household.cuisines)).sort();
  const hard = [...householdHardExclude(household.members)].sort();
  return `${regions.join(',')}|${hard.join(',')}`;
}

/** Reset the session memo (used by tests; harmless in app code). */
export function clearCorpusCache(): void {
  cache.clear();
}

/**
 * Resolve the recipe pool for a household. Always returns a non-empty,
 * safety-filtered array (falls back to the seed corpus when the DB can't serve).
 */
export async function fetchCorpusForHousehold(household: Household): Promise<TaggedRecipe[]> {
  const key = cacheKey(household);
  const memoized = cache.get(key);
  if (memoized) return memoized;

  const hard = householdHardExclude(household.members);
  const seedSafe = (): TaggedRecipe[] => getCorpus().filter((r) => isRecipeSafe(r.exclusionTokens, hard));

  let result = seedSafe();

  if (isSupabaseConfigured) {
    const regions = regionsInMix(normalizeCuisineMix(household.region, household.cuisines));
    try {
      const { data, error } = await supabase
        .from('recipe_corpus')
        .select(
          'title, cuisine, country_origin, course, ingredients, steps, servings, time_minutes, exclusion_tokens, diet_compatible, cost_tier, health_score, source, license, attribution_url',
        )
        .in('cuisine', regions)
        .gte('cuisine_confidence', MIN_CONFIDENCE);

      if (!error && data && data.length > 0) {
        const fetched = (data as CorpusRow[])
          .map(fromDbRow)
          .filter((r) => isRecipeSafe(r.exclusionTokens, hard));
        // Only prefer the DB pool if it actually yields safe dishes for this
        // household; otherwise keep the seed fallback.
        if (fetched.length > 0) result = fetched;
      }
    } catch {
      // Network/parse failure → keep the seed fallback already in `result`.
    }
  }

  cache.set(key, result);
  return result;
}
