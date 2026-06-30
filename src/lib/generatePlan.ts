/**
 * Client entry point for plan generation.
 *
 * MealMesh generates plans on its OWN deterministic engine — no external LLM
 * (Gemini/Claude) at runtime. This removes the quota/latency/truncation failure
 * modes a hosted model introduced, and makes generation instant, free, and
 * offline-capable.
 *
 * The engine (`generateLocalPlan`) builds a complete, safety-validated
 * procedural base and then overlays the richer recipe corpus where a safe,
 * same-cuisine, same-course dish exists — so plans get more varied and authentic
 * as the corpus grows, while always staying complete and safe.
 *
 * The corpus comes from `fetchCorpusForHousehold`: the Supabase `recipe_corpus`
 * table when configured + seeded, otherwise the in-memory seed corpus. Either
 * way the pool is pre-filtered for the household's HARD_EXCLUDE, and the engine
 * re-validates, so generation is always safe, instant, and offline-capable.
 *
 * `signedIn` is retained for future per-account personalization.
 */

import { fetchCorpusForHousehold } from '@/lib/fetchCorpus';
import { generateLocalPlan } from '@/lib/planEngine';
import type { Household, MealPlan } from '@/types';

export async function generatePlan(household: Household, seed: number, _signedIn: boolean): Promise<MealPlan> {
  const corpus = await fetchCorpusForHousehold(household);
  return generateLocalPlan(household, corpus, seed);
}
