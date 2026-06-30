/**
 * The local meal-planning engine — MealMesh's own deterministic generator, no
 * external LLM. It produces a full, safety-validated 7-day plan by:
 *
 *   1. Building a complete procedural base plan (mockPlan) — this already
 *      handles cuisine-mix %, budget, health-consciousness, completeness, and
 *      the deterministic safety validation. Nothing here can make a plan worse.
 *   2. OVERLAYING the richer recipe corpus: for each slot, if a safe,
 *      same-cuisine, same-course corpus dish exists (and hasn't been used this
 *      week), it replaces the procedural template with the real recipe.
 *   3. Re-consolidating the grocery list and re-running validatePlan as
 *      defense in depth.
 *
 * Because step 1 always yields a valid plan, the corpus is a pure enrichment:
 * an empty or sparse corpus degrades gracefully to the procedural output, and a
 * rich corpus makes every plan more varied and authentic — all offline, free,
 * and instant.
 */

import { deriveAllowList, unionHardExclusions, unionSoftAvoid, validatePlan } from '@/lib/constraints';
import { CUISINE_LABEL } from '@/lib/cuisine';
import { normalizeCuisineMix, pickCuisine } from '@/lib/cuisineMix';
import { consolidateGrocery } from '@/lib/grocery';
import { generateMockPlan } from '@/lib/mockPlan';
import { householdHardExclude, isRecipeSafe, type Course, type TaggedRecipe } from '@/lib/recipeCorpus';
import { MEAL_SLOTS, type ConstraintKey, type Household, type MealPlan, type MealSlot, type PlannedMeal, type Token } from '@/types';

/** Which corpus courses can fill each weekly slot. */
const COURSE_FOR_SLOT: Record<MealSlot, Course[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch', 'main'],
  supper: ['supper', 'appetizer'],
  dinner: ['dinner', 'main'],
  dessert: ['dessert'],
};

const DAYS_COUNT = 7;

function uniqueKeys(household: Household): ConstraintKey[] {
  const keys = new Set<ConstraintKey>();
  for (const m of household.members) for (const c of m.constraints) keys.add(c.key);
  return [...keys];
}

/** Stable 0..1 jitter for deterministic tie-breaking / variety. */
function jitter(s: string, i: number): number {
  let h = (i * 2654435761) >>> 0;
  for (let k = 0; k < s.length; k++) h = (Math.imul(h ^ s.charCodeAt(k), 16777619)) >>> 0;
  return (h % 1000) / 1000;
}

/** Coarse protein family for rotation — so the week doesn't lean on one meat. */
type ProteinFamily = 'chicken' | 'red_meat' | 'fish' | 'egg' | 'legume' | 'other';

function proteinFamily(r: TaggedRecipe): ProteinFamily {
  const text = r.ingredients.map((ing) => ing.name.toLowerCase()).join(' | ');
  if (/\b(chicken|turkey|poultry)\b/.test(text)) return 'chicken';
  if (/\b(beef|lamb|mutton|goat|pork|steak|mince|keema)\b/.test(text)) return 'red_meat';
  if (/\b(fish|salmon|tuna|cod|shrimp|prawn|crab|shellfish)\b/.test(text)) return 'fish';
  if (/\b(lentil|daal|dal|chickpea|bean|tofu|tempeh|paneer|legume)\b/.test(text)) return 'legume';
  if (/\b(egg|omelet|omelette)\b/.test(text)) return 'egg';
  return 'other';
}

/**
 * Generate a plan from the household, enriching the procedural base with the
 * given corpus. `corpus` may be empty — the plan is still complete and safe.
 */
export function generateLocalPlan(household: Household, corpus: TaggedRecipe[], seed = 0): MealPlan {
  const base = generateMockPlan(household, seed);
  if (corpus.length === 0) return base;

  const mix = normalizeCuisineMix(household.region, household.cuisines);
  const hard = householdHardExclude(household.members);
  const soft = new Set<Token>(unionSoftAvoid(household.members));
  const hc = household.healthConsciousness ?? 3;
  const budgetTight = household.budgetWeekly != null;
  const country = household.country;
  const householdKeys = uniqueKeys(household);
  const used = new Set<string>();
  // Protein families already used this week — repeats are penalized for variety.
  const proteinUsed = new Map<ProteinFamily, number>();

  const softHits = (r: TaggedRecipe): number =>
    r.exclusionTokens.reduce((n, t) => (soft.has(t) ? n + 1 : n), 0);

  const score = (r: TaggedRecipe, i: number): number => {
    let s = jitter(r.title, i);
    if (country && r.countryOrigin === country) s += 5; // country-specific dish wins (PK vs IN)
    s += (hc - 3) * (r.healthScore - 3) * 0.5; // align health-consciousness with leanness
    if (budgetTight) s += 3 - r.costTier; // gently prefer cheaper dishes under a budget
    s -= softHits(r) * 1.5; // a soft-avoided ingredient makes the dish less ideal
    s -= (proteinUsed.get(proteinFamily(r)) ?? 0) * 1.2; // rotate proteins across the week
    return s;
  };

  const upgraded: PlannedMeal[] = base.days.map((meal, idx) => {
    // Recover the same (day, slot) index mockPlan used so the cuisine choice
    // matches the base plan's intent for this slot.
    const dayIdx = Math.floor(idx / MEAL_SLOTS.length);
    const slotIdx = idx % MEAL_SLOTS.length;
    if (dayIdx >= DAYS_COUNT) return meal;
    const i = dayIdx * 17 + slotIdx + seed;
    const region = pickCuisine(mix, seed, i);
    const courses = COURSE_FOR_SLOT[meal.slot];

    const candidates = corpus.filter(
      (r) =>
        r.cuisine === region &&
        courses.includes(r.course) &&
        !used.has(r.title) &&
        isRecipeSafe(r.exclusionTokens, hard),
    );
    if (candidates.length === 0) return meal; // keep the safe procedural dish

    const best = candidates.reduce((a, b) => (score(b, i) > score(a, i) ? b : a));
    used.add(best.title);
    const fam = proteinFamily(best);
    proteinUsed.set(fam, (proteinUsed.get(fam) ?? 0) + 1);

    return {
      dayOfWeek: meal.dayOfWeek,
      slot: meal.slot,
      name: best.title,
      // 'shared' = safe AND not soft-avoided by anyone, so one dish suits all.
      // If a member soft-avoids one of its ingredients they take a simple swap,
      // so the dish is a 'variant' rather than a single shared plate.
      sharedOrVariant: softHits(best) > 0 ? 'variant' : 'shared',
      ingredients: best.ingredients.map((ing) => ing.name),
      // Only claim the constraints this dish actually satisfies (intersection of
      // the household's keys with the recipe's tagged compatibility).
      satisfies: householdKeys.filter((k) => best.dietCompatible.includes(k)),
      cuisine: CUISINE_LABEL[best.cuisine] ?? CUISINE_LABEL[region] ?? 'Everyday',
      recipe: { servings: best.servings ?? 4, timeMinutes: best.timeMinutes ?? 30, steps: best.steps },
    };
  });

  // Re-consolidate groceries from the upgraded meals and re-validate (defense in
  // depth — corpus dishes are pre-filtered safe, but we never trust blindly).
  const allow = deriveAllowList(household.members, [...new Set(mix.map((c) => c.region))]);
  const grocery = consolidateGrocery(upgraded, {
    proteinPool: [...allow.proteins, ...allow.legumes],
    grains: allow.grains,
    veg: allow.vegetables,
    oil: allow.oils,
    legumes: allow.legumes,
  });

  const hardArray: Token[] = unionHardExclusions(household.members);
  const { safePlan } = validatePlan({ days: upgraded, grocery }, hardArray, household.members);
  return safePlan;
}
