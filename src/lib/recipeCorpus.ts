/**
 * The recipe corpus: types + the source-agnostic INGEST tagger and the runtime
 * SAFETY filter for MealMesh's own deterministic meal engine (no external LLM).
 *
 * Two jobs live here:
 *
 *   1. tagRecipe()  — offline/build-time. Takes a normalized RawRecipe (from any
 *      source: a licensed dataset, our own templates, hand-authored content) and
 *      derives the safety tags by running each ingredient through the SAME
 *      lexicon the app enforces with (analyzeIngredient). This is the
 *      "deterministic safety at ingest" guarantee — a recipe's exclusion_tokens
 *      are computed by code, never declared by a data source we don't trust.
 *
 *   2. isRecipeSafeFor() — runtime. Exact array-overlap test against a
 *      household's HARD_EXCLUDE. No model, no network, no guessing: a recipe is
 *      safe iff none of its tokens are hard-excluded by ANY member.
 *
 * The DB column `recipes.exclusion_tokens` (migration 0013) stores tagRecipe's
 * output so the same logic that runs here at ingest can be a GIN-indexed SQL
 * filter at query time.
 */

import { analyzeIngredient, unionHardExclusions } from '@/lib/constraints';
import { DIET_DEFINITIONS } from '@/lib/dietLibrary';
import type { ConstraintKey, Member, Recipe, Region, Token } from '@/types';

/** Where a recipe sits in a day. 'main' covers a generic lunch/dinner entrée. */
export type Course = 'breakfast' | 'lunch' | 'supper' | 'dinner' | 'dessert' | 'appetizer' | 'drink' | 'main';

export interface RawIngredient {
  /** Free-text name as it should appear to the cook (e.g. "boneless chicken thigh"). */
  name: string;
  quantity?: number;
  unit?: string;
}

/** A recipe in the normalized shape every source must be mapped to before ingest. */
export interface RawRecipe {
  title: string;
  cuisine: Region;
  /** ISO country code — disambiguates a broad cuisine (e.g. 'PK' vs 'IN' under south_asian). */
  countryOrigin?: string;
  course: Course;
  ingredients: RawIngredient[];
  steps: string[];
  servings?: number;
  timeMinutes?: number;
  /** Provenance — carried through so licences can be honoured at display time. */
  source?: string;
  license?: string;
  attributionUrl?: string;
}

/** A RawRecipe plus the derived safety/scoring tags. This is what lands in Postgres. */
export interface TaggedRecipe extends RawRecipe {
  /** Union of every allergen/diet token any ingredient carries. The safety key. */
  exclusionTokens: Token[];
  /** Constraint keys this recipe fully satisfies (none of their excludes are present). */
  dietCompatible: ConstraintKey[];
  /** 1 cheap … 3 premium — coarse budget signal from the protein profile. */
  costTier: 1 | 2 | 3;
  /** 1 indulgent … 5 lean — coarse health signal from technique + protein. */
  healthScore: 1 | 2 | 3 | 4 | 5;
}

const ALL_KEYS = Object.keys(DIET_DEFINITIONS) as ConstraintKey[];

/* ------------------------------------------------------------------ */
/* Ingest tagging (offline / build-time)                              */
/* ------------------------------------------------------------------ */

/**
 * Derive a recipe's safety + scoring tags from its ingredients and steps.
 * Pure and deterministic — same input always yields the same tags, so a corpus
 * can be re-tagged reproducibly whenever the lexicon improves.
 */
export function tagRecipe(raw: RawRecipe): TaggedRecipe {
  // 1) Safety tokens: the union of analyzeIngredient over every ingredient.
  //    Over-detection is intentional (a false positive only narrows the pool;
  //    a false negative could surface a forbidden ingredient — never acceptable).
  const tokenSet = new Set<Token>();
  for (const ing of raw.ingredients) {
    for (const t of analyzeIngredient(ing.name)) tokenSet.add(t);
  }
  const exclusionTokens = [...tokenSet];

  // 2) Diet compatibility: a recipe satisfies a constraint iff NONE of that
  //    constraint's forbidden tokens are present. Mirrors the runtime test, so
  //    a recipe tagged `vegan`/`halal` here is provably safe for those members.
  const dietCompatible = ALL_KEYS.filter(
    (key) => !DIET_DEFINITIONS[key].excludes.some((t) => tokenSet.has(t)),
  );

  return {
    ...raw,
    servings: raw.servings ?? 4,
    timeMinutes: raw.timeMinutes ?? 30,
    exclusionTokens,
    dietCompatible,
    costTier: estimateCostTier(raw),
    healthScore: estimateHealthScore(raw),
  };
}

/** Cheap heuristic budget signal from the most-expensive protein present. */
function estimateCostTier(raw: RawRecipe): 1 | 2 | 3 {
  const text = raw.ingredients.map((i) => i.name.toLowerCase()).join(' | ');
  if (/\b(salmon|tuna|fish|cod|shrimp|prawn|beef|lamb|mutton|goat|steak)\b/.test(text)) return 3;
  if (/\b(chicken|turkey|paneer|cheese|egg|yogurt)\b/.test(text)) return 2;
  return 1; // legumes / grains / vegetables
}

/** Cheap heuristic leanness signal from cooking technique + protein profile. */
function estimateHealthScore(raw: RawRecipe): 1 | 2 | 3 | 4 | 5 {
  const steps = raw.steps.join(' ').toLowerCase();
  const ings = raw.ingredients.map((i) => i.name.toLowerCase()).join(' ');
  let score = 3;
  if (/\b(grill|bake|steam|boil|poach|roast)\b/.test(steps)) score += 1;
  if (/\b(deep-fry|deep fry|fried|fry|ghee|butter|cream|sugar|syrup)\b/.test(steps + ' ' + ings)) score -= 1;
  if (/\b(fish|chicken|turkey|lentil|chickpea|bean|tofu|tempeh|egg white|vegetable)\b/.test(ings)) score += 1;
  if (/\b(lamb|mutton|goat|beef|bacon|sausage)\b/.test(ings)) score -= 1;
  return Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
}

/* ------------------------------------------------------------------ */
/* Runtime safety filter                                              */
/* ------------------------------------------------------------------ */

/** The household's HARD_EXCLUDE as a fast lookup set. Compute once per plan. */
export function householdHardExclude(members: Member[]): Set<Token> {
  return new Set(unionHardExclusions(members));
}

/**
 * The single safety gate: true iff none of the recipe's tokens are hard-excluded.
 * This is the deterministic guarantee — exactly the array-overlap the SQL GIN
 * filter performs server-side, mirrored here for the client path.
 */
export function isRecipeSafe(exclusionTokens: Token[], hardExclude: Set<Token>): boolean {
  return !exclusionTokens.some((t) => hardExclude.has(t));
}

/** Convenience: a TaggedRecipe's `recipe` field for the plan, from its raw shape. */
export function toRecipe(r: TaggedRecipe): Recipe {
  return { servings: r.servings ?? 4, timeMinutes: r.timeMinutes ?? 30, steps: r.steps };
}
