/**
 * Supabase persistence for households + weekly plans.
 *
 * Maps the app's domain types (src/types) to the database rows (see
 * supabase/migrations/0001_init.sql) and back. All writes run as the signed-in
 * user, so Row Level Security guarantees a user only ever touches their own
 * rows. The in-memory `draft` (src/lib/draft.ts) is still used for the instant,
 * signed-out demo flow; once a user signs in we persist the draft and load from
 * here on return.
 */

import { makeConstraint } from '@/lib/constraints';
import { supabase } from '@/lib/supabase';
import type { AgeBand, Household, MealPlan, Member, Region } from '@/types';

/* ------------------------------------------------------------------ */
/* Row shapes (we don't generate DB types, so map explicitly)         */
/* ------------------------------------------------------------------ */

interface HouseholdRow {
  id: string;
  name: string;
  region_preference: Region;
}

interface MemberRow {
  id: string;
  name: string;
  age_band: AgeBand;
  calorie_target: number | null;
  member_constraints: ConstraintRow[];
}

interface ConstraintRow {
  constraint_key: string;
  type: string;
  severity: string;
}

interface PlanRow {
  plan_json: MealPlan['days'];
  grocery_json: MealPlan['grocery'];
}

/* ------------------------------------------------------------------ */
/* Households                                                         */
/* ------------------------------------------------------------------ */

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Persist a household for the signed-in user. There is one household per user,
 * so we replace any existing one (the cascade clears its members, constraints
 * and plans). Returns the reloaded household with real DB ids, or null if not
 * signed in.
 */
export async function saveHousehold(h: Household): Promise<Household | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  // Replace any existing household (cascade clears children).
  await supabase.from('households').delete().eq('owner_user_id', userId);

  const { data: hData, error: hErr } = await supabase
    .from('households')
    .insert({ owner_user_id: userId, name: h.name, region_preference: h.region })
    .select('id')
    .single();
  if (hErr || !hData) return null;
  const householdId = (hData as { id: string }).id;

  for (const m of h.members) {
    const { data: mData } = await supabase
      .from('members')
      .insert({
        household_id: householdId,
        name: m.name,
        age_band: m.ageBand,
        calorie_target: m.calorieTarget,
      })
      .select('id')
      .single();
    if (!mData) continue;
    const memberId = (mData as { id: string }).id;
    if (m.constraints.length) {
      await supabase.from('member_constraints').insert(
        m.constraints.map((c) => ({
          member_id: memberId,
          constraint_key: c.key,
          type: c.category,
          severity: c.severity,
        })),
      );
    }
  }

  return loadHousehold();
}

/** Load the signed-in user's household, or null if none / not signed in. */
export async function loadHousehold(): Promise<Household | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data: hData } = await supabase
    .from('households')
    .select('id, name, region_preference')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!hData) return null;
  const household = hData as HouseholdRow;

  const { data: mData } = await supabase
    .from('members')
    .select('id, name, age_band, calorie_target, member_constraints(constraint_key, type, severity)')
    .eq('household_id', household.id);
  const memberRows = (mData ?? []) as MemberRow[];

  const members: Member[] = memberRows.map((row) => ({
    id: row.id,
    name: row.name,
    ageBand: row.age_band,
    calorieTarget: row.calorie_target,
    // Rebuild via the library so category/severity stay authoritative.
    constraints: row.member_constraints.map((c) =>
      makeConstraint(c.constraint_key as Member['constraints'][number]['key'], c.severity as 'hard' | 'soft'),
    ),
  }));

  return { id: household.id, name: household.name, region: household.region_preference, members };
}

/* ------------------------------------------------------------------ */
/* Weekly plans                                                       */
/* ------------------------------------------------------------------ */

/** ISO date (YYYY-MM-DD) for the Monday of the current week. */
export function currentWeekStart(): string {
  const d = new Date();
  const mondayOffset = (d.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0, …
  d.setDate(d.getDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

/** Upsert a generated plan for a household + week. No-op without a real id. */
export async function savePlan(householdId: string, weekStart: string, plan: MealPlan): Promise<void> {
  if (householdId === 'draft') return;
  await supabase.from('meal_plans').upsert(
    {
      household_id: householdId,
      week_start: weekStart,
      plan_json: plan.days,
      grocery_json: plan.grocery,
    },
    { onConflict: 'household_id,week_start' },
  );
}

/** Load a saved plan for a household + week, or null if none. */
export async function loadPlan(householdId: string, weekStart: string): Promise<MealPlan | null> {
  if (householdId === 'draft') return null;
  const { data } = await supabase
    .from('meal_plans')
    .select('plan_json, grocery_json')
    .eq('household_id', householdId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (!data) return null;
  const row = data as PlanRow;
  return { days: row.plan_json, grocery: row.grocery_json };
}
