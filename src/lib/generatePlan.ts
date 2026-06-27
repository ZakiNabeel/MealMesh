/**
 * Client entry point for plan generation. Prefers the real Anthropic-backed
 * Edge Function (`supabase/functions/generate-plan`) when the user is signed
 * in and Supabase is configured; falls back to the local mock generator
 * otherwise (offline, signed out, or the function isn't deployed yet) so the
 * app always produces a plan. Both paths return the identical `MealPlan`
 * shape and the server path is already re-validated by the engine before it
 * gets here — nothing extra to check on the client.
 */

import { generateMockPlan } from '@/lib/mockPlan';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Household, MealPlan } from '@/types';

export async function generatePlan(household: Household, seed: number, signedIn: boolean): Promise<MealPlan> {
  if (signedIn && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke<{ plan: MealPlan }>('generate-plan', {
        body: { household, seed },
      });
      if (!error && data?.plan) return data.plan;
    } catch {
      // network/deploy issue — fall through to the mock generator below
    }
  }
  return generateMockPlan(household, seed);
}
