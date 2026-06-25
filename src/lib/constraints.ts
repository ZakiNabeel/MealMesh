/**
 * MealMesh constraint engine — the moat.
 *
 * Pure, deterministic, dependency-free TypeScript. No `any`. This module turns
 * a household's member profiles into:
 *
 *   • HARD_EXCLUDE — tokens that must NEVER appear in a plan (safety guarantee).
 *   • SOFT_AVOID   — tokens to prefer against (guidance only).
 *   • ALLOW        — a POSITIVE pantry of staples that are actually usable.
 *
 * …and then validates a generated plan against HARD_EXCLUDE deterministically,
 * so an unsafe meal can never reach the user even if the model gets it wrong.
 *
 * The data it reads (diet definitions, staples, the ingredient lexicon) lives
 * in ./dietLibrary.ts.
 */

import type {
  AllowList,
  ConstraintCategory,
  ConstraintKey,
  MealPlan,
  Member,
  MemberConstraint,
  Region,
  Severity,
  Token,
  ValidationResult,
  Violation,
} from '@/types';
import {
  DIET_DEFINITIONS,
  type DietDefinition,
  INGREDIENT_LEXICON,
  LEXICON_OVERRIDES,
  REGIONS,
  STAPLES,
  type Staple,
  type StapleGroup,
} from '@/lib/dietLibrary';

/* ------------------------------------------------------------------ */
/* Definition lookup + UI helpers                                     */
/* ------------------------------------------------------------------ */

export function getDefinition(key: ConstraintKey): DietDefinition {
  return DIET_DEFINITIONS[key];
}

/** Build a member constraint with the library's category + default severity. */
export function makeConstraint(key: ConstraintKey, severity?: Severity): MemberConstraint {
  const def = DIET_DEFINITIONS[key];
  return {
    key,
    category: def.category,
    // Allergens are always hard regardless of any override.
    severity: def.category === 'allergen' ? 'hard' : severity ?? def.defaultSeverity,
  };
}

const CATEGORY_ORDER: ConstraintCategory[] = ['religious', 'lifestyle', 'medical', 'allergen'];

/** Constraints grouped by category, for rendering the onboarding chip picker. */
export function constraintsByCategory(): Array<{
  category: ConstraintCategory;
  items: DietDefinition[];
}> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: Object.values(DIET_DEFINITIONS).filter((d) => d.category === category),
  }));
}

/* ------------------------------------------------------------------ */
/* Ingredient analysis (the safety net)                               */
/* ------------------------------------------------------------------ */

/**
 * Map a free-text ingredient string to the set of tokens it contains.
 *
 * Biased toward OVER-detection: a false positive only causes a safe meal to be
 * regenerated, whereas a false negative could show a forbidden ingredient — so
 * when in doubt we flag. Multi-word OVERRIDES are matched and consumed first so
 * that, e.g., "almond milk" never falls through to the generic "milk" → dairy
 * rule.
 */
export function analyzeIngredient(raw: string): Set<Token> {
  const tokens = new Set<Token>();
  // Normalize: lowercase, strip punctuation, pad with spaces for \b matching.
  let s = ' ' + raw.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';

  for (const rule of LEXICON_OVERRIDES) {
    if (rule.re.test(s)) {
      for (const t of rule.tokens) tokens.add(t);
      s = s.replace(rule.re, ' ');
    }
  }
  for (const rule of INGREDIENT_LEXICON) {
    if (rule.re.test(s)) {
      for (const t of rule.tokens) tokens.add(t);
    }
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Exclusion / avoidance unions                                       */
/* ------------------------------------------------------------------ */

function collectExcludes(members: Member[], severity: Severity): Token[] {
  const out = new Set<Token>();
  for (const member of members) {
    for (const c of member.constraints) {
      if (c.severity !== severity) continue;
      for (const t of DIET_DEFINITIONS[c.key].excludes) out.add(t);
    }
  }
  return [...out];
}

/** Union of every HARD exclusion across all members. Never to be violated. */
export function unionHardExclusions(members: Member[]): Token[] {
  return collectExcludes(members, 'hard');
}

/** Union of soft preferences (minus anything already hard-excluded). */
export function unionSoftAvoid(members: Member[]): Token[] {
  const hard = new Set(unionHardExclusions(members));
  return collectExcludes(members, 'soft').filter((t) => !hard.has(t));
}

/* ------------------------------------------------------------------ */
/* Positive ALLOW list                                                */
/* ------------------------------------------------------------------ */

function prioritizeByRegion(staples: Staple[], region: Region): Staple[] {
  if (region === 'none') return staples;
  return [...staples].sort((a, b) => {
    const aHit = a.regions?.includes(region) ? 0 : 1;
    const bHit = b.regions?.includes(region) ? 0 : 1;
    return aHit - bHit;
  });
}

/**
 * Derive the positive pantry. A staple survives if NONE of its tokens are
 * hard-excluded. `universal` staples additionally avoid every soft preference,
 * so they are the safe basis for shared (whole-household) dishes.
 */
export function deriveAllowList(members: Member[], region: Region): AllowList {
  const hard = new Set(unionHardExclusions(members));
  const soft = new Set(unionSoftAvoid(members));

  const allowed = STAPLES.filter((s) => !s.tokens.some((t) => hard.has(t)));
  const ordered = prioritizeByRegion(allowed, region);

  const namesIn = (group: StapleGroup): string[] =>
    ordered.filter((s) => s.group === group).map((s) => s.name);

  const universal = ordered
    .filter((s) => !s.tokens.some((t) => hard.has(t) || soft.has(t)))
    .map((s) => s.name);

  return {
    proteins: namesIn('protein'),
    grains: namesIn('grain'),
    oils: namesIn('oil'),
    vegetables: namesIn('vegetable'),
    legumes: namesIn('legume'),
    universal,
    notes: buildNotes(members, region),
  };
}

function buildNotes(members: Member[], region: Region): string[] {
  const notes: string[] = [];
  if (region !== 'none') notes.push(REGIONS[region].hint);

  const hardLabels = uniqueLabels(members, 'hard');
  notes.push(
    hardLabels.length
      ? `Every shared dish must satisfy ALL of: ${hardLabels.join(', ')}.`
      : 'No hard restrictions — shared dishes can use any pantry item.',
  );

  const softLabels = uniqueLabels(members, 'soft');
  if (softLabels.length) notes.push(`Prefer to minimize (soft): ${softLabels.join(', ')}.`);

  return notes;
}

function uniqueLabels(members: Member[], severity: Severity): string[] {
  const keys = new Set<ConstraintKey>();
  for (const m of members) {
    for (const c of m.constraints) if (c.severity === severity) keys.add(c.key);
  }
  return [...keys].map((k) => DIET_DEFINITIONS[k].label);
}

/* ------------------------------------------------------------------ */
/* Deterministic safety-validation pass                               */
/* ------------------------------------------------------------------ */

const TOKEN_REASONS: Partial<Record<Token, string>> = {
  pork: 'contains pork',
  alcohol: 'contains alcohol',
  shellfish: 'contains shellfish',
  fish: 'contains fish',
  peanuts: 'contains peanuts',
  tree_nuts: 'contains tree nuts',
  dairy: 'contains dairy',
  lactose: 'contains lactose',
  eggs: 'contains eggs',
  soy: 'contains soy',
  wheat: 'contains wheat',
  gluten: 'contains gluten',
  sesame: 'contains sesame',
  mustard: 'contains mustard',
  corn: 'contains corn',
  sulfites: 'contains sulfites',
  caffeine: 'contains caffeine',
  nightshades: 'contains nightshades',
  gelatin: 'contains gelatin',
  lard: 'contains lard',
  high_mercury_fish: 'is a high-mercury fish (unsafe in pregnancy)',
  raw_fish: 'is raw fish (unsafe in pregnancy)',
  raw_egg: 'contains raw egg (unsafe in pregnancy)',
  unpasteurized: 'is unpasteurized (unsafe in pregnancy)',
  deli_meat: 'is deli/cured meat (unsafe in pregnancy)',
  meat_dairy_mix: 'mixes meat and dairy in one meal (not kosher)',
  animal_flesh: 'contains an animal product',
  meat: 'contains meat',
  beef: 'contains beef',
};

function reasonFor(token: Token): string {
  return TOKEN_REASONS[token] ?? `contains ${token.replace(/_/g, ' ')}`;
}

const LAND_MEAT_TOKENS: Token[] = ['meat', 'poultry', 'beef', 'red_meat', 'pork'];

/**
 * The deterministic safety pass. Walks every meal, flags any ingredient whose
 * analyzed tokens intersect HARD_EXCLUDE, and returns BOTH the list of
 * violations and a `safePlan` with all violating meals removed. The Edge
 * Function uses the violations to regenerate; the UI is only ever handed a
 * plan that passed this check.
 *
 * `members` is used for the kosher meat-and-dairy rule, which depends on a
 * whole meal rather than a single ingredient.
 */
export function validatePlan(
  plan: MealPlan,
  hardExclude: Token[],
  members: Member[] = [],
): ValidationResult {
  const hardSet = new Set(hardExclude);
  const kosherActive =
    hardSet.has('meat_dairy_mix') &&
    members.some((m) => m.constraints.some((c) => c.key === 'kosher' && c.severity === 'hard'));

  const violations: Violation[] = [];
  const safeDays = plan.days.filter((meal) => {
    const before = violations.length;
    const mealTokens = new Set<Token>();

    for (const ingredient of meal.ingredients) {
      const toks = analyzeIngredient(ingredient);
      for (const t of toks) {
        mealTokens.add(t);
        if (hardSet.has(t)) {
          violations.push({
            dayOfWeek: meal.dayOfWeek,
            slot: meal.slot,
            mealName: meal.name,
            ingredient,
            token: t,
            reason: `"${ingredient}" ${reasonFor(t)}`,
          });
        }
      }
    }

    if (kosherActive) {
      const hasLandMeat = LAND_MEAT_TOKENS.some((t) => mealTokens.has(t));
      const hasDairy = mealTokens.has('dairy') || mealTokens.has('lactose');
      if (hasLandMeat && hasDairy) {
        violations.push({
          dayOfWeek: meal.dayOfWeek,
          slot: meal.slot,
          mealName: meal.name,
          ingredient: 'meat + dairy together',
          token: 'meat_dairy_mix',
          reason: `"${meal.name}" ${reasonFor('meat_dairy_mix')}`,
        });
      }
    }

    return violations.length === before; // keep meal only if it added no violations
  });

  // Defensively scrub the grocery list too.
  const safeGrocery = plan.grocery.filter(
    (item) => ![...analyzeIngredient(item.name)].some((t) => hardSet.has(t)),
  );

  return {
    ok: violations.length === 0,
    violations,
    safePlan: { days: safeDays, grocery: safeGrocery },
  };
}
