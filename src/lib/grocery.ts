/**
 * Consolidated grocery list builder — shared by the procedural generator
 * (mockPlan) and the corpus-driven engine (planEngine) so both produce one
 * deduplicated, real-unit shopping list from a week of meals.
 *
 * Ingredients are aggregated by canonical name across every meal, then turned
 * into a realistic whole-week shopping amount (kg/g/dozen/L/ml/pcs) scaled by
 * how many meals call for each — never a raw occurrence count.
 */

import type { GroceryItem, PlannedMeal } from '@/types';

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Trim a trailing ".0" off a one-decimal amount, e.g. 1.0 -> "1", 1.5 -> "1.5". */
const trimDecimal = (n: number): string => (n % 1 === 0 ? String(n) : n.toFixed(1));

/** Loose pantry groups, used only to categorize the shopping list + pick a unit. */
export interface PantryGroups {
  proteinPool: string[];
  grains: string[];
  veg: string[];
  oil: string[];
  legumes: string[];
}

/** A real shopping amount for the whole week, scaled by how many meals use it. */
export function quantityFor(category: string, name: string, timesUsed: number): string {
  if (name.includes('egg')) {
    const count = timesUsed * 2;
    return count >= 12 ? `${trimDecimal(count / 12)} dozen` : `${count} pcs`;
  }
  if (category === 'Oils & pantry') {
    const ml = timesUsed * 30;
    return ml >= 1000 ? `${trimDecimal(ml / 1000)} L` : `${ml} ml`;
  }
  const gramsPerUse: Record<string, number> = { Protein: 300, Legumes: 150, Grains: 200 };
  const perUse = gramsPerUse[category];
  if (perUse) {
    const grams = timesUsed * perUse;
    return grams >= 1000 ? `${trimDecimal(grams / 1000)} kg` : `${grams} g`;
  }
  return `${timesUsed} pcs`; // produce — countable items
}

/** Aggregate every meal's ingredients into one categorized, real-unit list. */
export function consolidateGrocery(days: PlannedMeal[], groups: PantryGroups): GroceryItem[] {
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
    .map(([name, n]) => {
      const category = categoryOf(name);
      return { name: cap(name), category, quantity: quantityFor(category, name, n) };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
