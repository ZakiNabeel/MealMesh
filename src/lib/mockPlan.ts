/**
 * Placeholder plan generator — builds a 7-day plan locally so the whole flow
 * works before the Gemini Edge Function is deployed. It composes meals from
 * the engine's ALLOW pantry and region-appropriate flavors (see cuisine.ts),
 * so a South Asian household gets karahi / daal / biryani rather than generic
 * Western templates.
 *
 * Safety is preserved two ways: every added aromatic is checked against the
 * household's HARD_EXCLUDE before it can enter a meal, and the finished plan is
 * run through the same deterministic `validatePlan` pass the Edge Function
 * uses. Swap `generateMockPlan` for the Edge Function call later — the shape
 * (`MealPlan`) is identical.
 */

import { ingredientCostUsd, weeklyLocal } from '@/lib/budget';
import { analyzeIngredient, deriveAllowList, unionHardExclusions, validatePlan } from '@/lib/constraints';
import { buildRegionalMeal } from '@/lib/cuisine';
import { MEAL_SLOTS, type ConstraintKey, type DayOfWeek, type GroceryItem, type Household, type MealPlan, type MealSlot, type PlannedMeal, type Token } from '@/types';

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pick(list: string[], i: number, fallback: string): string {
  return list.length ? list[i % list.length] : fallback;
}

export function generateMockPlan(household: Household, seed = 0): MealPlan {
  const allow = deriveAllowList(household.members, household.region);
  const hardSet = new Set<Token>(unionHardExclusions(household.members));
  const universal = new Set(allow.universal);

  // A flavor ingredient is usable only if none of its tokens are hard-excluded.
  const isSafe = (ingredient: string): boolean =>
    ![...analyzeIngredient(ingredient)].some((t) => hardSet.has(t));

  const legumeSet = new Set(allow.legumes);
  // Proteins to cook around: real proteins first, then legumes as a fallback.
  const proteins = allow.proteins.filter((p) => !/yogurt|paneer/i.test(p));
  const proteinPool = [...proteins, ...allow.legumes];
  const safeProteins = proteinPool.length ? proteinPool : ['mixed beans'];
  const grains = allow.grains.length ? allow.grains : ['rice'];
  const veg = allow.vegetables.length ? allow.vegetables : ['seasonal vegetables'];
  const oil = allow.oils.length ? allow.oils : ['olive oil'];

  const satisfies = uniqueKeys(household);

  // Four meals per day: breakfast, lunch, supper, dinner. Built around a given
  // protein pool so we can retry with a cheaper pool if a budget is set.
  const buildDays = (pool: string[]): PlannedMeal[] => {
    const out: PlannedMeal[] = [];
    DAYS.forEach((day, dayIdx) => {
      MEAL_SLOTS.forEach((slot: MealSlot, slotIdx) => {
        const i = dayIdx * 4 + slotIdx + seed;
        // Breakfasts read best with eggs — use them when the household allows it.
        const eggsOk = pool.includes('eggs');
        const protein = slot === 'breakfast' && eggsOk && i % 3 !== 0 ? 'eggs' : pick(pool, i, 'mixed beans');
        const grain = pick(grains, i + 1, 'rice');
        const v1 = pick(veg, i, 'seasonal vegetables');
        const v2 = pick(veg, i + 2, 'greens');
        const fat = pick(oil, i, 'olive oil');
        const isLegume = legumeSet.has(protein);

        const dish = buildRegionalMeal({
          region: household.region,
          slot,
          protein,
          grain,
          veg: v1,
          veg2: v2,
          fat,
          isLegume,
          seed: i,
          isSafe,
        });

        const ingredients = dedupe([protein, grain, v1, v2, fat, ...dish.extras]);
        const shared = ingredients.every((ing) => universal.has(ing) || isSafe(ing));

        out.push({
          dayOfWeek: day,
          slot,
          name: dish.name,
          sharedOrVariant: shared ? 'shared' : 'variant',
          ingredients,
          satisfies,
          cuisine: dish.cuisine,
          recipe: dish.recipe,
        });
      });
    });
    return out;
  };

  let days = buildDays(safeProteins);

  // Budget-aware: if the week's local-price estimate blows the household's
  // budget, rebuild around the more affordable proteins (legumes, eggs, chicken
  // before lamb).
  const budget = household.budgetWeekly ?? null;
  if (budget != null && weeklyLocal({ days, grocery: [] }, household.country) > budget) {
    const cheapestFirst = [...safeProteins].sort((a, b) => ingredientCostUsd(a) - ingredientCostUsd(b));
    const affordable = cheapestFirst.filter((p) => ingredientCostUsd(p) <= 1.0);
    days = buildDays(affordable.length ? affordable : cheapestFirst.slice(0, Math.max(1, Math.ceil(cheapestFirst.length / 2))));
  }

  const grocery = buildGrocery(days, { proteinPool: safeProteins, grains, veg, oil, legumes: allow.legumes });

  // Defense in depth: never hand back a meal that fails the safety pass. The
  // validator filters whole meal objects, so cuisine/recipe survive intact.
  const { safePlan } = validatePlan({ days, grocery }, [...hardSet], household.members);
  return safePlan;
}

function uniqueKeys(household: Household): ConstraintKey[] {
  const keys = new Set<ConstraintKey>();
  for (const m of household.members) for (const c of m.constraints) keys.add(c.key);
  return [...keys];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(i);
    }
  }
  return out;
}

function buildGrocery(
  days: PlannedMeal[],
  groups: { proteinPool: string[]; grains: string[]; veg: string[]; oil: string[]; legumes: string[] },
): GroceryItem[] {
  const counts = new Map<string, number>();
  for (const d of days) for (const ing of d.ingredients) counts.set(ing, (counts.get(ing) ?? 0) + 1);

  const categoryOf = (name: string): string => {
    if (groups.legumes.includes(name)) return 'Legumes';
    if (groups.proteinPool.includes(name)) return 'Protein';
    if (groups.grains.includes(name)) return 'Grains';
    if (groups.oil.includes(name)) return 'Oils & pantry';
    return 'Produce';
  };

  return [...counts.entries()]
    .map(([name, n]) => ({ name: cap(name), category: categoryOf(name), quantity: `×${n}` }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
