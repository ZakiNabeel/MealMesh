/**
 * Client entry point for plan generation.
 *
 * MealMesh generates plans on its OWN deterministic engine — no external LLM
 * (Gemini/Claude) at runtime. This removes the quota/latency/truncation failure
 * modes a hosted model introduced, and makes generation instant, free, and
 * offline-capable.
 *
 * The engine (`generateLocalPlan`) builds a complete, safety-validated
 * procedural base and then overlays the richer recipe corpus (src/lib/corpus.ts)
 * where a safe, same-cuisine, same-course dish exists — so plans get more varied
 * and authentic as the corpus grows, while always staying complete and safe.
 *
 * Kept `async` for call-site compatibility and a future move of the corpus to a
 * Supabase fetch. `signedIn` is retained for future per-account personalization.
 */

import { getCorpus } from '@/lib/corpus';
import { generateLocalPlan } from '@/lib/planEngine';
import type { Household, MealPlan } from '@/types';

export async function generatePlan(household: Household, seed: number, _signedIn: boolean): Promise<MealPlan> {
  return generateLocalPlan(household, getCorpus(), seed);
}
