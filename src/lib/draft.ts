/**
 * Lightweight in-memory hand-off for the household being built in onboarding.
 *
 * This is intentionally simple — it carries the draft from the onboarding
 * screen to the plan screen within a session. Persistence to Supabase happens
 * once auth is wired (the draft maps 1:1 onto the `households` / `members` /
 * `member_constraints` tables).
 */

import type { Household } from '@/types';

let current: Household | null = null;

export function setDraftHousehold(h: Household): void {
  current = h;
}

export function getDraftHousehold(): Household | null {
  return current;
}

/**
 * A stable signature of everything about a household that affects plan
 * generation. The plan screen compares this against the plan it's showing to
 * decide whether a household edit means the plan must be regenerated — so
 * editing diets/members/cuisine in settings actually changes the next plan.
 */
export function householdSignature(h: Household): string {
  return JSON.stringify({
    region: h.region,
    cuisines: h.cuisines ?? null,
    country: h.country ?? null,
    budget: h.budgetWeekly ?? null,
    health: h.healthConsciousness ?? 3,
    members: h.members.map((m) => ({
      age: m.ageBand,
      keys: m.constraints.map((c) => c.key).sort(),
    })),
  });
}
