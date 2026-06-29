/**
 * Builds the Surprise Me / Guests-are-here spread: exactly one appetizer, one
 * main course, one drink, and one dessert — each safe, region-appropriate,
 * and runnable through the same constraint engine as the weekly plan.
 *
 * Separate from `mockPlan.ts` because a "course" (appetizer/main/drink/dessert)
 * isn't a weekly `MealSlot` — there's no day, and "drink" has no slot at all.
 */

import { analyzeIngredient, deriveAllowList, unionHardExclusions } from '@/lib/constraints';
import { buildRegionalDessert, buildRegionalDrink, buildRegionalMeal } from '@/lib/cuisine';
import type { Household, Recipe, Token } from '@/types';

export type Course = 'appetizer' | 'main' | 'drink' | 'dessert';

export const COURSE_LABEL: Record<Course, string> = {
  appetizer: 'Appetizer',
  main: 'Main course',
  drink: 'Drink',
  dessert: 'Dessert',
};

export interface CourseDish {
  course: Course;
  name: string;
  cuisine: string;
  ingredients: string[];
  recipe: Recipe;
}

const FRUITS = ['banana', 'mango', 'apple', 'mixed berries', 'orange', 'pear'];

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

function pick(list: string[], i: number, fallback: string): string {
  return list.length ? list[((i % list.length) + list.length) % list.length] : fallback;
}

/**
 * `pantryItems` (optional) — what the user said they have on hand; when
 * given, the appetizer + main lean on those instead of the household's
 * default pantry, same "build around what's there" idea as Cook From What I
 * Have, just feeding this builder instead of the weekly generator.
 */
export function buildSurpriseSpread(household: Household, seed = 0, pantryItems: string[] = []): CourseDish[] {
  const allow = deriveAllowList(household.members, household.region);
  const hardSet = new Set<Token>(unionHardExclusions(household.members));
  const isSafe = (ingredient: string): boolean => ![...analyzeIngredient(ingredient)].some((t) => hardSet.has(t));

  const legumeSet = new Set(allow.legumes);
  const defaultProteins = allow.proteins.filter((p) => !/yogurt|paneer/i.test(p));
  const defaultPool = [...defaultProteins, ...allow.legumes];
  const safePantry = pantryItems.filter(isSafe);
  const healthConsciousness = household.healthConsciousness ?? 3;

  let proteinPool = safePantry.length ? safePantry : defaultPool;
  if (healthConsciousness >= 4) {
    const isLean = (p: string) => /fish|chicken|turkey|egg|lentil|chickpea|bean|tofu|tempeh/i.test(p);
    proteinPool = [...proteinPool].sort((a, b) => Number(isLean(b)) - Number(isLean(a)));
  }
  const safeProteins = proteinPool.length ? proteinPool : ['mixed beans'];
  const grains = allow.grains.length ? allow.grains : ['rice'];
  const veg = (safePantry.length ? safePantry : allow.vegetables).length ? (safePantry.length ? safePantry : allow.vegetables) : ['seasonal vegetables'];
  const oil = allow.oils.length ? allow.oils : ['olive oil'];

  function buildCourse(course: Course, slot: 'supper' | 'dinner', i: number): CourseDish {
    const protein = pick(safeProteins, i, 'mixed beans');
    const grain = pick(grains, i + 1, 'rice');
    const v1 = pick(veg, i, 'seasonal vegetables');
    const v2 = pick(veg, i + 2, 'greens');
    const fat = pick(oil, i, 'olive oil');
    const isLegume = legumeSet.has(protein);
    const dish = buildRegionalMeal({ region: household.region, slot, protein, grain, veg: v1, veg2: v2, fat, isLegume, seed: i, isSafe });
    return {
      course,
      name: dish.name,
      cuisine: dish.cuisine,
      ingredients: dedupe([protein, grain, v1, v2, fat, ...dish.extras].filter((ing) => isSafe(ing) || allow.universal.includes(ing))),
      recipe: dish.recipe,
    };
  }

  const appetizer = buildCourse('appetizer', 'supper', seed);
  const main = buildCourse('main', 'dinner', seed + 7);

  const fruit = pick(FRUITS, seed + 3, 'mixed berries');
  const dessertGrain = pick(grains, seed + 4, 'rice');
  const dessertDish = buildRegionalDessert({ region: household.region, fruit, grain: dessertGrain, seed: seed + 3, isSafe, healthConsciousness });
  const dessert: CourseDish = {
    course: 'dessert',
    name: dessertDish.name,
    cuisine: dessertDish.cuisine,
    ingredients: dedupe([fruit, dessertGrain, 'sugar', ...dessertDish.extras]),
    recipe: dessertDish.recipe,
  };

  const drinkDish = buildRegionalDrink({ region: household.region, seed: seed + 5, isSafe });
  const drink: CourseDish = {
    course: 'drink',
    name: drinkDish.name,
    cuisine: drinkDish.cuisine,
    ingredients: dedupe(['sugar', ...drinkDish.extras]),
    recipe: drinkDish.recipe,
  };

  return [appetizer, main, drink, dessert];
}
