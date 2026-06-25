/**
 * MealMesh shared domain types.
 *
 * These mirror the Supabase data model (see context doc §3) and are the
 * single source of truth for the constraint engine. Dietary logic must be
 * type-safe — a wrong type here is a user-safety bug — so there is no `any`
 * anywhere in this file or in /lib/constraints.ts.
 */

/* ------------------------------------------------------------------ */
/* Households & members                                               */
/* ------------------------------------------------------------------ */

export type AgeBand = 'child' | 'teen' | 'adult';

export type Region =
  | 'south_asian'
  | 'middle_eastern'
  | 'mediterranean'
  | 'east_asian'
  | 'latin'
  | 'african'
  | 'none';

/** Where a constraint comes from. Drives UI grouping. */
export type ConstraintCategory = 'religious' | 'lifestyle' | 'medical' | 'allergen';

/**
 * 'hard' = NEVER violate (safety guarantee, enforced by the deterministic
 * validation pass). 'soft' = prefer to avoid (guidance only).
 */
export type Severity = 'hard' | 'soft';

/**
 * Every dietary constraint we support. Stored as `constraint_key` in
 * `member_constraints`. Grouped in the UI under category headers.
 */
export type ConstraintKey =
  // Religious / cultural
  | 'halal'
  | 'kosher'
  | 'hindu_vegetarian'
  | 'jain'
  | 'buddhist'
  | 'sikh'
  | 'rastafarian_ital'
  | 'sda'
  | 'lds'
  | 'orthodox_lenten'
  // Lifestyle
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'flexitarian'
  | 'raw_food'
  | 'pollotarian'
  // Medical
  | 'diabetic'
  | 'gluten_free'
  | 'low_fodmap'
  | 'renal'
  | 'low_sodium_cardiac'
  | 'keto'
  | 'paleo'
  | 'whole30'
  | 'mediterranean'
  | 'autoimmune_aip'
  | 'prenatal'
  // Allergens (always HARD severity)
  | 'dairy'
  | 'eggs'
  | 'peanuts'
  | 'tree_nuts'
  | 'soy'
  | 'wheat'
  | 'fish'
  | 'shellfish'
  | 'sesame'
  | 'lactose'
  | 'nightshades'
  | 'sulfites'
  | 'mustard'
  | 'corn'
  | 'caffeine';

/**
 * Canonical exclusion tokens. Both the diet library (what a constraint
 * forbids) and the ingredient lexicon (what an ingredient string contains)
 * speak this vocabulary, so the union must be kept in sync across both.
 * Keeping it a closed union — rather than free `string` — is deliberate:
 * the compiler catches a typo that would otherwise be a silent safety hole.
 */
export type Token =
  // Allergens & concrete food groups
  | 'dairy'
  | 'lactose'
  | 'eggs'
  | 'peanuts'
  | 'tree_nuts'
  | 'coconut'
  | 'soy'
  | 'wheat'
  | 'gluten'
  | 'barley'
  | 'rye'
  | 'fish'
  | 'shellfish'
  | 'sesame'
  | 'mustard'
  | 'corn'
  | 'sulfites'
  | 'caffeine'
  | 'nightshades'
  // Animal / religious
  | 'pork'
  | 'beef'
  | 'red_meat'
  | 'poultry'
  | 'meat' // any land-animal flesh
  | 'animal_flesh' // meat + poultry + fish + shellfish (anything that was an animal)
  | 'gelatin'
  | 'lard'
  | 'alcohol'
  | 'honey'
  | 'blood'
  /** Derived: a single meal containing both meat and dairy (kosher rule). */
  | 'meat_dairy_mix'
  // Plant / preparation / medical
  | 'onion'
  | 'garlic'
  | 'allium'
  | 'root_vegetables'
  | 'legumes'
  | 'grains'
  | 'starchy'
  | 'added_sugar'
  | 'refined_carbs'
  | 'processed'
  | 'additives'
  | 'high_sodium'
  | 'high_potassium'
  | 'high_phosphorus'
  | 'high_mercury_fish'
  | 'raw_fish'
  | 'raw_egg'
  | 'unpasteurized'
  | 'deli_meat'
  | 'coffee'
  | 'tea';

export interface MemberConstraint {
  key: ConstraintKey;
  category: ConstraintCategory;
  severity: Severity;
}

export interface Member {
  id: string;
  name: string;
  ageBand: AgeBand;
  calorieTarget: number | null;
  constraints: MemberConstraint[];
}

export interface Household {
  id: string;
  name: string;
  region: Region;
  /** ISO country code (e.g. 'PK', 'US'). Drives currency + budget. */
  country?: string;
  /** ISO currency code (e.g. 'PKR', 'USD'). Derived from country. */
  currency?: string;
  members: Member[];
}

/* ------------------------------------------------------------------ */
/* Constraint-engine outputs                                          */
/* ------------------------------------------------------------------ */

/**
 * Positive guidance handed to the model. Listing what IS allowed (not only
 * what is forbidden) is the core insight: it stops the model guessing unsafe
 * substitutes. `universal` items are safe for every member, so they are the
 * right basis for shared dishes.
 */
export interface AllowList {
  proteins: string[];
  grains: string[];
  oils: string[];
  vegetables: string[];
  legumes: string[];
  /** Staples (any category) that satisfy EVERY member — use for shared dishes. */
  universal: string[];
  /** Human-readable hints for the model (region cuisine, strictest-member rule). */
  notes: string[];
}

/** The full structured input the Edge Function sends to Claude. */
export interface PlanRequest {
  members: Array<{ name: string; constraints: MemberConstraint[] }>;
  hardExclude: Token[];
  softAvoid: Token[];
  allow: AllowList;
  region: Region;
  days: number;
}

/* ------------------------------------------------------------------ */
/* Generated plan shapes                                              */
/* ------------------------------------------------------------------ */

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type MealSlot = 'breakfast' | 'lunch' | 'supper' | 'dinner';

/** The four daily meals, in order. */
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'supper', 'dinner'];

/** Step-by-step cooking guide shown when a meal card is opened. */
export interface Recipe {
  servings: number;
  timeMinutes: number;
  steps: string[];
}

export interface PlannedMeal {
  dayOfWeek: DayOfWeek;
  slot: MealSlot;
  name: string;
  /** 'shared' = one dish for everyone; 'variant' = simple per-member swaps. */
  sharedOrVariant: 'shared' | 'variant';
  ingredients: string[];
  /** Which member constraints this meal is designed to satisfy. */
  satisfies: ConstraintKey[];
  /** Human cuisine label, e.g. 'South Asian'. Drives the region-majority rule. */
  cuisine?: string;
  /** Full recipe with numbered instructions. */
  recipe?: Recipe;
}

export interface GroceryItem {
  name: string;
  /** Loose category for grouping the shopping list, e.g. 'produce', 'protein'. */
  category: string;
  quantity?: string;
}

export interface MealPlan {
  days: PlannedMeal[];
  grocery: GroceryItem[];
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export interface Violation {
  dayOfWeek: DayOfWeek;
  slot: MealSlot;
  mealName: string;
  ingredient: string;
  /** The hard-excluded token this ingredient tripped. */
  token: Token;
  /** Human-readable reason, e.g. "contains pork (haram / allergen)". */
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
  /** The plan with violating meals removed — never contains a violation. */
  safePlan: MealPlan;
}
