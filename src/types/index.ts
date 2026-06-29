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
  | 'chinese'
  | 'latin'
  | 'african'
  | 'american'
  | 'european'
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

/** One cuisine in a household's mix, with its share of the week's meals (0-100). */
export interface CuisineWeight {
  region: Region;
  percent: number;
}

export interface Household {
  id: string;
  name: string;
  /** The dominant/primary cuisine — kept as the single source of truth for
   *  the safety-relevant ALLOW-list pantry filter and as the fallback when
   *  `cuisines` is unset. Always equal to the highest-weighted entry in
   *  `cuisines` when that's set. */
  region: Region;
  /**
   * Optional multi-cuisine mix (e.g. 80% Pakistani-style south_asian + 20%
   * Chinese) — lets a household blend more than one cuisine instead of being
   * locked to a single region. Percentages sum to 100. When unset or a
   * single entry, behaves exactly like the old single-`region` household.
   */
  cuisines?: CuisineWeight[];
  /** ISO country code (e.g. 'PK', 'US'). Drives currency + budget, and
   *  disambiguates a broad region (e.g. south_asian) toward that country's
   *  home cooking rather than the region's stereotype. */
  country?: string;
  /** ISO currency code (e.g. 'PKR', 'USD'). Derived from country. */
  currency?: string;
  /** Optional target weekly grocery budget, in the local currency. */
  budgetWeekly?: number;
  /**
   * 1 (not health-conscious) – 5 (extremely health-conscious, e.g. gym-goers
   * tracking macros). Moderates sugar/oil/fried-food usage and leans on
   * leaner proteins + fruit-forward desserts as it rises. Defaults to 3
   * (moderate) when unset.
   */
  healthConsciousness?: number;
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

/** The full structured input the Edge Function sends to the AI provider. */
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

export type MealSlot = 'breakfast' | 'lunch' | 'supper' | 'dinner' | 'dessert';

/** The five daily meals, in order. */
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'supper', 'dinner', 'dessert'];

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

/* ------------------------------------------------------------------ */
/* Social: public identity + cooking logs (Milestone 1)               */
/* ------------------------------------------------------------------ */

/**
 * A user's PUBLIC identity. Deliberately separate from `Household`/`Member`:
 * a public profile must NEVER carry dietary/medical constraints (context doc
 * §10). `isPublic` is opt-in and defaults to false — a profile is invisible to
 * others until the user turns it on.
 */
export interface Profile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  /** Optional, for regional leaderboards — never a member's constraint data. */
  region: string | null;
  /** Denormalized from subscription_status so OTHER users' rows can show flair. */
  isPro: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Social: follow graph + leaderboard + crews (Milestone 2)           */
/* ------------------------------------------------------------------ */

export type LeaderboardScope = 'global' | 'friends' | 'region' | 'crew';

/** One ranked row — a public-safe projection, never dietary data. */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPro: boolean;
  totalPoints: number;
  currentStreak: number;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

/** One row in a followers/following list — a public-safe profile projection. */
export interface FollowListEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPro: boolean;
}

/** A Pro-only private group with its own leaderboard. */
export interface Crew {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  memberCount: number;
}

/** The cached cooking totals behind a leaderboard row / public profile — read from `user_stats`. */
export interface CookingStats {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  mealsLogged: number;
  cleanPlateDays: number;
  perfectWeeks: number;
}

/**
 * A record that the signed-in user cooked one meal of their plan. Keyed by
 * plan COORDINATES (week + day + slot), since plans are opaque JSONB with no
 * per-meal rows. Tied to `userId` (stable), not `householdId`, so editing a
 * household never wipes cooking history. The photo is the honor-system proof.
 */
export interface MealLog {
  id: string;
  userId: string;
  /** ISO date of the plan week's Monday (matches `meal_plans.week_start`). */
  weekStart: string;
  dayOfWeek: DayOfWeek;
  slot: MealSlot;
  /** Snapshot of the meal name at log time (the plan can regenerate). */
  mealName: string;
  photoUrl: string | null;
  caption: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Social: community feed + recipe sharing (Milestone 3)              */
/* ------------------------------------------------------------------ */

export type PostType = 'text' | 'photo' | 'recipe';

export type FeedSort = 'hot' | 'new' | 'top' | 'following';

export type VoteTargetType = 'post' | 'comment';

/**
 * A user-submitted recipe shared to the community. Free-text content —
 * unlike `PlannedMeal`/`Recipe` (the engine's output), this is NEVER run
 * through `validatePlan`. The UI must make that distinction clear: a
 * household's hard constraints are not checked against community recipes.
 */
export interface CommunityRecipe {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ingredients: string[];
  steps: string[];
  cuisine: string | null;
  dietTags: string[];
  isPublic: boolean;
  createdAt: string;
}

/** Public-safe author projection embedded in feed/post/comment rows. */
export interface AuthorSummary {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPro: boolean;
}

export interface Post {
  id: string;
  author: AuthorSummary;
  type: PostType;
  body: string | null;
  imageUrl: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  score: number;
  myVote: -1 | 0 | 1;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  author: AuthorSummary;
  parentCommentId: string | null;
  body: string;
  score: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
  replies: Comment[];
}
