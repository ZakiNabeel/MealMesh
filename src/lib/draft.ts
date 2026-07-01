/**
 * In-memory hand-off for the household being built in onboarding, carried to
 * the plan screen within a session. Persistence to Supabase happens once
 * auth is wired (the draft maps 1:1 onto the `households` / `members` /
 * `member_constraints` tables).
 *
 * On web this is also mirrored to `localStorage`. The email magic-link and
 * Google OAuth flows both bounce through a full-page redirect (see
 * `pendingUsername.ts`), which wipes plain module state — without this, a
 * guest who builds a household/plan and then signs in loses everything and
 * has to redo onboarding. `localStorage` is synchronous, so callers that rely
 * on `getDraftHousehold()` returning synchronously (several `useState`
 * initializers) don't need to change.
 */

import type { Household } from '@/types';

const DRAFT_KEY = 'mm_draft_household';

function readStorage(): Household | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Household) : null;
  } catch {
    return null;
  }
}

function writeStorage(h: Household | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (h) localStorage.setItem(DRAFT_KEY, JSON.stringify(h));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable — non-fatal, falls back to in-memory only */
  }
}

let current: Household | null = readStorage();

export function setDraftHousehold(h: Household): void {
  current = h;
  writeStorage(h);
}

export function getDraftHousehold(): Household | null {
  return current;
}

/** Clear the draft once it's safely persisted to Supabase. */
export function clearDraftHousehold(): void {
  current = null;
  writeStorage(null);
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
