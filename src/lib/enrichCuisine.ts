/**
 * Cuisine + course ENRICHMENT for externally-sourced recipes (e.g. a Kaggle
 * dump where rows carry a title + ingredients but no reliable cuisine label).
 *
 * Pure and dependency-free: it takes a `Gazetteer` (the reference data in
 * `data/*.json`, injected — never read from disk here) so it's deterministic and
 * unit-testable. The fs/Supabase glue lives in `scripts/ingest-kaggle.ts`.
 *
 * Three confidence tiers, highest wins:
 *   1. national_dish  — the title IS a known national/iconic dish → country+region (95 exact / 88 substring)
 *   2. title_rule     — the title contains a strong cuisine keyword (e.g. 'teriyaki') → region (85)
 *   3. ingredient_fp  — the ingredient set best matches a region's fingerprint → region (70–85 by margin)
 *
 * The ingest step keeps only rows scoring >= MIN_CONFIDENCE (80); everything
 * below is too uncertain to tag a household's plan with, so it's dropped.
 */

import type { Region } from '@/types';
import type { Course } from '@/lib/recipeCorpus';

export const MIN_CONFIDENCE = 80;

export type TagMethod = 'national_dish' | 'title_rule' | 'ingredient_fp' | 'none';

export interface TitleRule {
  kw: string;
  region: Region;
  country?: string;
}

export interface Gazetteer {
  /** normalized dish name -> ISO country code */
  nationalDishes: Record<string, string>;
  /** ISO country code -> Region */
  countryToRegion: Record<string, Region>;
  titleRules: TitleRule[];
  /** Region -> { ingredient substring -> weight } */
  regionProfiles: Record<string, Record<string, number>>;
}

export interface EnrichResult {
  cuisine: Region;
  countryOrigin?: string;
  confidence: number;
  method: TagMethod;
}

/**
 * Shape the four raw `data/*.json` blobs into a `Gazetteer`, dropping the
 * `_comment` doc keys. Shared by the ingest script (loads via fs) and the unit
 * test (imports the JSON directly) so both speak the exact same reference data.
 */
export function buildGazetteer(raw: {
  nationalDishes: Record<string, string>;
  countryToRegion: Record<string, string>;
  titleRules: { rules: TitleRule[] };
  regionProfiles: { profiles: Record<string, Record<string, number>> };
}): Gazetteer {
  const strip = <T>(obj: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) out[k] = v;
    return out;
  };
  return {
    nationalDishes: strip(raw.nationalDishes),
    countryToRegion: strip(raw.countryToRegion) as Record<string, Region>,
    titleRules: raw.titleRules.rules,
    regionProfiles: strip(raw.regionProfiles.profiles),
  };
}

/** Lowercase, strip punctuation, collapse whitespace — the matching form. */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole-word-ish substring test (avoids 'dal' matching inside 'dالiance'). */
function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  return re.test(haystack);
}

/* ------------------------------------------------------------------ */
/* Layer 1 — national dish                                            */
/* ------------------------------------------------------------------ */

function matchNationalDish(title: string, gaz: Gazetteer): EnrichResult | null {
  const country = gaz.nationalDishes[title]; // exact normalized title
  if (country) {
    const region = gaz.countryToRegion[country];
    if (region) return { cuisine: region, countryOrigin: country, confidence: 95, method: 'national_dish' };
  }
  // Substring: the title CONTAINS a known dish (e.g. "easy chicken biryani").
  // Prefer the longest matching key so "green curry" beats "curry".
  let best: { key: string; country: string } | null = null;
  for (const [dish, iso] of Object.entries(gaz.nationalDishes)) {
    if (dish.startsWith('_')) continue;
    if (containsPhrase(title, dish) && (!best || dish.length > best.key.length)) {
      best = { key: dish, country: iso };
    }
  }
  if (best) {
    const region = gaz.countryToRegion[best.country];
    if (region) return { cuisine: region, countryOrigin: best.country, confidence: 88, method: 'national_dish' };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Layer 2 — title keyword rules                                      */
/* ------------------------------------------------------------------ */

function matchTitleRule(title: string, gaz: Gazetteer): EnrichResult | null {
  let best: TitleRule | null = null;
  for (const rule of gaz.titleRules) {
    if (containsPhrase(title, rule.kw) && (!best || rule.kw.length > best.kw.length)) best = rule;
  }
  if (best) return { cuisine: best.region, countryOrigin: best.country, confidence: 85, method: 'title_rule' };
  return null;
}

/* ------------------------------------------------------------------ */
/* Layer 3 — ingredient fingerprint                                   */
/* ------------------------------------------------------------------ */

function matchIngredientFingerprint(ingredients: string[], gaz: Gazetteer): EnrichResult | null {
  const hay = ` ${ingredients.map((i) => normalizeTitle(i)).join(' | ')} `;
  const scores: Array<{ region: Region; score: number }> = [];
  for (const [region, profile] of Object.entries(gaz.regionProfiles)) {
    if (region.startsWith('_')) continue;
    let score = 0;
    for (const [ing, weight] of Object.entries(profile)) {
      if (containsPhrase(hay, normalizeTitle(ing))) score += weight;
    }
    if (score > 0) scores.push({ region: region as Region, score });
  }
  if (scores.length === 0) return null;
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1]?.score ?? 0;
  // Need a meaningful signal AND a clear winner to be worth tagging.
  if (top.score < 5) return null;
  const margin = (top.score - second) / top.score; // 0..1
  const confidence = Math.round(70 + 15 * margin); // 70..85
  return { cuisine: top.region, confidence, method: 'ingredient_fp' };
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Best cuisine guess for a recipe. Always returns a result; callers compare
 * `.confidence` against `MIN_CONFIDENCE` to decide whether to keep the row.
 * A total miss returns `{ cuisine: 'none', confidence: 0, method: 'none' }`.
 */
export function enrichCuisine(
  rawTitle: string,
  ingredients: string[],
  gaz: Gazetteer,
): EnrichResult {
  const title = normalizeTitle(rawTitle);
  return (
    matchNationalDish(title, gaz) ??
    matchTitleRule(title, gaz) ??
    matchIngredientFingerprint(ingredients, gaz) ?? { cuisine: 'none', confidence: 0, method: 'none' }
  );
}

/* ------------------------------------------------------------------ */
/* Course heuristics                                                  */
/* ------------------------------------------------------------------ */

const COURSE_CUES: Array<{ course: Course; re: RegExp }> = [
  { course: 'dessert', re: /\b(cake|pie|cookie|brownie|pudding|tart|mousse|cheesecake|ice cream|gelato|baklava|tiramisu|custard|dessert|sweet|donut|doughnut|cupcake)s?\b/ },
  { course: 'breakfast', re: /\b(pancake|waffle|omelet|omelette|scrambled|oatmeal|granola|porridge|french toast|breakfast|cereal|muesli|frittata)s?\b/ },
  { course: 'drink', re: /\b(smoothie|juice|latte|cocktail|lemonade|milkshake|tea|coffee|punch)s?\b/ },
  { course: 'appetizer', re: /\b(dip|salad|appetizer|starter|hummus|guacamole|bruschetta|salsa)s?\b/ },
];

/** Coarse course from the title; defaults to 'main'. */
export function deriveCourse(rawTitle: string): Course {
  const t = normalizeTitle(rawTitle);
  for (const { course, re } of COURSE_CUES) if (re.test(t)) return course;
  return 'main';
}
