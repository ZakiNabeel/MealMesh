/**
 * "Cook from what I have" — given a list of ingredients the user has on hand
 * (plus their household constraints, if any), suggest safe dishes built around
 * those ingredients. Reuses the cuisine engine for region-appropriate names +
 * recipes and the deterministic `validatePlan` pass so a suggestion can never
 * contain a hard-excluded ingredient.
 */

import { analyzeIngredient, unionHardExclusions, validatePlan } from '@/lib/constraints';
import { buildRegionalMeal } from '@/lib/cuisine';
import { STAPLES, type StapleGroup } from '@/lib/dietLibrary';
import type { Household, PlannedMeal, Region, Token } from '@/types';

export interface Suggestion {
  meal: PlannedMeal;
  /** Extra staples (aromatics/grain) the recipe wants that weren't on the list. */
  alsoNeed: string[];
}

export interface CookFromResult {
  suggestions: Suggestion[];
  /** Items we skipped because they break a household rule. */
  excluded: { name: string; reason: string }[];
}

const PROTEIN_TOKENS: Token[] = ['meat', 'poultry', 'beef', 'red_meat', 'pork', 'animal_flesh', 'fish', 'shellfish'];

function categorize(name: string): StapleGroup | 'unknown' {
  const lower = name.trim().toLowerCase();
  const staple = STAPLES.find(
    (s) => lower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(lower),
  );
  if (staple) return staple.group;
  const toks = analyzeIngredient(name);
  if ([...toks].some((t) => PROTEIN_TOKENS.includes(t))) return 'protein';
  if (toks.has('legumes')) return 'legume';
  if (toks.has('grains')) return 'grain';
  if (toks.size === 0) return 'unknown';
  return 'vegetable';
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (i && !seen.has(k)) {
      seen.add(k);
      out.push(i);
    }
  }
  return out;
}

export function cookFrom(have: string[], household: Household | null): CookFromResult {
  const region: Region = household?.region ?? 'none';
  const members = household?.members ?? [];
  const hard = unionHardExclusions(members);
  const hardSet = new Set(hard);
  const isSafe = (ing: string) => ![...analyzeIngredient(ing)].some((t) => hardSet.has(t));

  const clean = dedupe(have.map((h) => h.trim()).filter(Boolean));
  const excluded = clean
    .filter((h) => !isSafe(h))
    .map((h) => ({ name: h, reason: 'not allowed for your household' }));
  const usable = clean.filter(isSafe);

  const proteins = usable.filter((u) => categorize(u) === 'protein');
  const legumes = usable.filter((u) => categorize(u) === 'legume');
  const grains = usable.filter((u) => categorize(u) === 'grain');
  const veg = usable.filter((u) => {
    const c = categorize(u);
    return c === 'vegetable' || c === 'unknown';
  });
  const proteinPool = [...proteins, ...legumes];
  const haveSet = new Set(usable.map((u) => u.toLowerCase()));

  const suggestions: Suggestion[] = [];
  const seenNames = new Set<string>();
  const rounds = Math.min(6, Math.max(proteinPool.length, veg.length, 1) + 2);

  for (let i = 0; i < rounds; i++) {
    const protein = proteinPool.length
      ? proteinPool[i % proteinPool.length]
      : veg.length
        ? veg[i % veg.length]
        : 'mixed vegetables';
    const grainFallback = grains.length === 0;
    const grain = grains.length ? grains[i % grains.length] : 'rice';
    const v1 = veg.length ? veg[i % veg.length] : 'seasonal vegetables';
    const v2 = veg.length > 1 ? veg[(i + 1) % veg.length] : v1;
    const isLegume = legumes.some((l) => l.toLowerCase() === protein.toLowerCase());

    const dish = buildRegionalMeal({
      region,
      slot: 'dinner',
      protein,
      grain,
      veg: v1,
      veg2: v2,
      fat: 'oil',
      isLegume,
      seed: i,
      isSafe,
    });

    const ingredients = dedupe([protein, grain, v1, v2]);
    const meal: PlannedMeal = {
      dayOfWeek: 'monday',
      slot: 'dinner',
      name: dish.name,
      sharedOrVariant: 'shared',
      ingredients,
      satisfies: [],
      cuisine: dish.cuisine,
      recipe: dish.recipe,
    };

    if (seenNames.has(meal.name)) continue;
    const result = validatePlan({ days: [meal], grocery: [] }, hard, members);
    if (!result.ok) continue;
    seenNames.add(meal.name);

    const alsoNeed = dedupe([
      ...dish.extras,
      ...(grainFallback ? [grain] : []),
    ]).filter((x) => !haveSet.has(x.toLowerCase()) && x !== 'seasonal vegetables');

    suggestions.push({ meal, alsoNeed });
  }

  return { suggestions, excluded };
}
