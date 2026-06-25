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
