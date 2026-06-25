/**
 * Rough grocery-budget estimator. Assigns each ingredient an approximate USD
 * cost-per-serving by keyword (proteins cost more, grains/pantry less), sums a
 * meal, then a week. It is deliberately a *rough* figure shown as "est." — it
 * helps a household sense the cost of a plan, not balance the books. The number
 * is converted to local currency for display (see geo.ts).
 */

import type { MealPlan } from '@/types';

/** Approx USD cost per serving, matched by keyword. First match wins. */
const COST_RULES: { re: RegExp; usd: number }[] = [
  { re: /lamb|goat|mutton|beef|steak|veal/i, usd: 2.2 },
  { re: /shrimp|prawn|salmon|fish|cod|tilapia/i, usd: 1.8 },
  { re: /chicken|turkey|duck/i, usd: 1.2 },
  { re: /paneer|cheese|greek yogurt/i, usd: 1.0 },
  { re: /tofu|tempeh|eggs?/i, usd: 0.7 },
  { re: /lentil|chickpea|bean|daal|dal|legume/i, usd: 0.4 },
  { re: /rice|quinoa|oats|bread|pasta|tortilla|grain|flour|roti|naan/i, usd: 0.35 },
  { re: /oil|ghee|butter|spice|cumin|masala|turmeric|coriander|salt/i, usd: 0.2 },
  { re: /spinach|broccoli|carrot|cauliflower|zucchini|cucumber|tomato|pepper|onion|garlic|ginger|vegetable|greens/i, usd: 0.4 },
];

const DEFAULT_COST = 0.4;

/** Approx USD cost of one serving of a single ingredient (market-price estimate). */
export function ingredientCostUsd(name: string): number {
  for (const rule of COST_RULES) if (rule.re.test(name)) return rule.usd;
  return DEFAULT_COST;
}

const ingredientCost = ingredientCostUsd;

/** Estimated USD cost to cook one meal (per serving). */
export function mealCostUsd(ingredients: string[]): number {
  return ingredients.reduce((sum, ing) => sum + ingredientCost(ing), 0);
}

/** Estimated USD grocery cost for the whole plan (per serving across the week). */
export function weeklyCostUsd(plan: MealPlan): number {
  return plan.days.reduce((sum, meal) => sum + mealCostUsd(meal.ingredients), 0);
}
