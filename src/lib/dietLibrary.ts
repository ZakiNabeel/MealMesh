/**
 * MealMesh diet library — the DATA behind the constraint engine.
 *
 * Three things live here:
 *   1. DIET_DEFINITIONS  — every supported constraint and the tokens it forbids.
 *   2. STAPLES + REGIONS — the positive pantry used to build the ALLOW list.
 *   3. INGREDIENT_LEXICON — keyword → token map. This is the safety net that
 *      lets us detect a forbidden ingredient in free-text model output.
 *
 * The engine logic that consumes this lives in ./constraints.ts. Keeping data
 * and logic separate makes the library auditable: a nutritionist can review
 * these tables without reading code.
 *
 * Cultural/religious defaults below are sensible STARTING points and are meant
 * to be edited per member in the UI — households vary. Severity is chosen by
 * the user; allergens are always 'hard'.
 */

import type {
  ConstraintCategory,
  ConstraintKey,
  Region,
  Severity,
  Token,
} from '@/types';

/* ================================================================== */
/* 1. Diet definitions                                                */
/* ================================================================== */

export interface DietDefinition {
  key: ConstraintKey;
  label: string;
  category: ConstraintCategory;
  /** Default severity when a user first adds this constraint. */
  defaultSeverity: Severity;
  /** Tokens this constraint forbids (becomes HARD_EXCLUDE or SOFT_AVOID). */
  excludes: Token[];
  /** Short note shown in the UI / passed to the model for context. */
  note?: string;
}

export const DIET_DEFINITIONS: Record<ConstraintKey, DietDefinition> = {
  /* ---------- Religious / cultural ---------- */
  halal: {
    key: 'halal',
    label: 'Halal',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['pork', 'alcohol', 'lard', 'blood', 'gelatin'],
    note: 'No pork, alcohol, or non-halal animal products. Meat should be halal-certified.',
  },
  kosher: {
    key: 'kosher',
    label: 'Kosher',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['pork', 'shellfish', 'lard', 'blood', 'gelatin', 'meat_dairy_mix'],
    note: 'No pork or shellfish, no mixing meat and dairy in the same meal.',
  },
  hindu_vegetarian: {
    key: 'hindu_vegetarian',
    label: 'Hindu vegetarian',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['animal_flesh', 'eggs', 'beef'],
    note: 'Lacto-vegetarian; no meat, fish, or eggs. Dairy allowed.',
  },
  jain: {
    key: 'jain',
    label: 'Jain',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['animal_flesh', 'eggs', 'root_vegetables', 'onion', 'garlic', 'honey'],
    note: 'Vegetarian; also no root vegetables, onion, garlic, or honey.',
  },
  buddhist: {
    key: 'buddhist',
    label: 'Buddhist',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['animal_flesh'],
    note: 'Vegetarian; many also avoid the five pungent alliums and alcohol.',
  },
  sikh: {
    key: 'sikh',
    label: 'Sikh',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['beef'],
    note: 'Commonly avoids beef and ritually-slaughtered (halal/kosher) meat. Many keep a vegetarian kitchen.',
  },
  rastafarian_ital: {
    key: 'rastafarian_ital',
    label: 'Rastafarian (Ital)',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['animal_flesh', 'pork', 'alcohol'],
    note: 'Plant-based Ital diet; no meat, pork, shellfish, or alcohol. Often avoids additives and salt.',
  },
  sda: {
    key: 'sda',
    label: 'Seventh-day Adventist',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['pork', 'shellfish', 'alcohol'],
    note: 'No pork, shellfish, or alcohol. Lacto-ovo vegetarian is encouraged.',
  },
  lds: {
    key: 'lds',
    label: 'Latter-day Saint (Word of Wisdom)',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['alcohol', 'coffee', 'tea'],
    note: 'No alcohol, coffee, or tea.',
  },
  orthodox_lenten: {
    key: 'orthodox_lenten',
    label: 'Orthodox (Lenten fast)',
    category: 'religious',
    defaultSeverity: 'hard',
    excludes: ['meat', 'fish', 'dairy', 'lactose', 'eggs'],
    note: 'Seasonal fast: no meat, fish-with-backbone, dairy, or eggs. Shellfish and plant foods are allowed.',
  },

  /* ---------- Lifestyle ---------- */
  vegetarian: {
    key: 'vegetarian',
    label: 'Vegetarian',
    category: 'lifestyle',
    defaultSeverity: 'hard',
    excludes: ['animal_flesh', 'gelatin'],
    note: 'No meat, poultry, fish, or shellfish. Dairy and eggs allowed.',
  },
  vegan: {
    key: 'vegan',
    label: 'Vegan',
    category: 'lifestyle',
    defaultSeverity: 'hard',
    excludes: ['animal_flesh', 'dairy', 'lactose', 'eggs', 'honey', 'gelatin'],
    note: 'No animal products of any kind.',
  },
  pescatarian: {
    key: 'pescatarian',
    label: 'Pescatarian',
    category: 'lifestyle',
    defaultSeverity: 'hard',
    excludes: ['meat'],
    note: 'No land-animal meat or poultry. Fish, shellfish, dairy, and eggs allowed.',
  },
  flexitarian: {
    key: 'flexitarian',
    label: 'Flexitarian',
    category: 'lifestyle',
    defaultSeverity: 'soft',
    excludes: ['red_meat', 'processed'],
    note: 'Mostly plant-based; reduces red and processed meat.',
  },
  raw_food: {
    key: 'raw_food',
    label: 'Raw food',
    category: 'lifestyle',
    defaultSeverity: 'soft',
    excludes: ['processed', 'refined_carbs'],
    note: 'Prefers uncooked, unprocessed plant foods.',
  },
  pollotarian: {
    key: 'pollotarian',
    label: 'Pollotarian',
    category: 'lifestyle',
    defaultSeverity: 'hard',
    excludes: ['red_meat', 'fish', 'shellfish'],
    note: 'Poultry only; no red meat or seafood.',
  },

  /* ---------- Medical ---------- */
  diabetic: {
    key: 'diabetic',
    label: 'Diabetic-friendly',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['added_sugar', 'refined_carbs'],
    note: 'Limits added sugar and refined carbohydrates; favors low-glycemic foods.',
  },
  gluten_free: {
    key: 'gluten_free',
    label: 'Gluten-free',
    category: 'medical',
    defaultSeverity: 'hard',
    excludes: ['gluten', 'wheat', 'barley', 'rye'],
    note: 'No wheat, barley, rye, or other gluten sources (e.g. coeliac).',
  },
  low_fodmap: {
    key: 'low_fodmap',
    label: 'Low-FODMAP',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['onion', 'garlic', 'wheat', 'lactose', 'legumes'],
    note: 'Limits high-FODMAP foods: onion, garlic, wheat, lactose, certain legumes.',
  },
  renal: {
    key: 'renal',
    label: 'Renal (kidney)',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['high_potassium', 'high_phosphorus', 'high_sodium'],
    note: 'Limits potassium, phosphorus, and sodium.',
  },
  low_sodium_cardiac: {
    key: 'low_sodium_cardiac',
    label: 'Low-sodium (cardiac)',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['high_sodium', 'processed', 'deli_meat'],
    note: 'Limits sodium and processed/cured foods.',
  },
  keto: {
    key: 'keto',
    label: 'Keto',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['grains', 'starchy', 'added_sugar', 'refined_carbs', 'legumes'],
    note: 'Very low carbohydrate; no grains, starches, sugar, or legumes.',
  },
  paleo: {
    key: 'paleo',
    label: 'Paleo',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['grains', 'legumes', 'dairy', 'lactose', 'added_sugar', 'processed'],
    note: 'No grains, legumes, dairy, refined sugar, or processed foods.',
  },
  whole30: {
    key: 'whole30',
    label: 'Whole30',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['grains', 'legumes', 'dairy', 'lactose', 'added_sugar', 'alcohol', 'additives'],
    note: '30-day elimination: no grains, legumes, dairy, added sugar, alcohol, or additives.',
  },
  mediterranean: {
    key: 'mediterranean',
    label: 'Mediterranean',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: ['red_meat', 'processed', 'added_sugar'],
    note: 'Emphasizes olive oil, fish, vegetables, legumes, and whole grains.',
  },
  autoimmune_aip: {
    key: 'autoimmune_aip',
    label: 'Autoimmune protocol (AIP)',
    category: 'medical',
    defaultSeverity: 'soft',
    excludes: [
      'grains',
      'legumes',
      'dairy',
      'lactose',
      'eggs',
      'nightshades',
      'tree_nuts',
      'peanuts',
      'sesame',
      'alcohol',
      'processed',
    ],
    note: 'Elimination protocol; removes grains, legumes, dairy, eggs, nightshades, nuts, and seeds.',
  },
  prenatal: {
    key: 'prenatal',
    label: 'Prenatal',
    category: 'medical',
    defaultSeverity: 'hard',
    excludes: [
      'alcohol',
      'raw_fish',
      'raw_egg',
      'unpasteurized',
      'high_mercury_fish',
      'deli_meat',
    ],
    note: 'Pregnancy-safe: no alcohol, raw fish/eggs, unpasteurized foods, high-mercury fish, or deli meats. Limit caffeine.',
  },

  /* ---------- Allergens (always HARD) ---------- */
  dairy: allergen('dairy', 'Dairy allergy', ['dairy', 'lactose']),
  eggs: allergen('eggs', 'Egg allergy', ['eggs', 'raw_egg']),
  peanuts: allergen('peanuts', 'Peanut allergy', ['peanuts']),
  tree_nuts: allergen('tree_nuts', 'Tree-nut allergy', ['tree_nuts']),
  soy: allergen('soy', 'Soy allergy', ['soy']),
  wheat: allergen('wheat', 'Wheat allergy', ['wheat']),
  fish: allergen('fish', 'Fish allergy', ['fish']),
  shellfish: allergen('shellfish', 'Shellfish allergy', ['shellfish']),
  sesame: allergen('sesame', 'Sesame allergy', ['sesame']),
  lactose: allergen('lactose', 'Lactose intolerance', ['lactose']),
  nightshades: allergen('nightshades', 'Nightshade sensitivity', ['nightshades']),
  sulfites: allergen('sulfites', 'Sulfite sensitivity', ['sulfites']),
  mustard: allergen('mustard', 'Mustard allergy', ['mustard']),
  corn: allergen('corn', 'Corn allergy', ['corn']),
  caffeine: allergen('caffeine', 'Caffeine sensitivity', ['caffeine', 'coffee', 'tea']),
};

/** Allergen constraints share the same shape; this keeps the table terse. */
function allergen(key: ConstraintKey, label: string, excludes: Token[]): DietDefinition {
  return { key, label, category: 'allergen', defaultSeverity: 'hard', excludes };
}

/* ================================================================== */
/* 2. Positive pantry — staples & regions                             */
/* ================================================================== */

export type StapleGroup = 'protein' | 'grain' | 'oil' | 'vegetable' | 'legume';

export interface Staple {
  name: string;
  group: StapleGroup;
  tokens: Token[];
  /** Cuisines where this staple is common; used to bias the ALLOW list. */
  regions?: Region[];
}

export const STAPLES: Staple[] = [
  // Proteins
  { name: 'chicken', group: 'protein', tokens: ['poultry', 'meat', 'animal_flesh'] },
  { name: 'turkey', group: 'protein', tokens: ['poultry', 'meat', 'animal_flesh'] },
  { name: 'beef', group: 'protein', tokens: ['beef', 'red_meat', 'meat', 'animal_flesh'] },
  { name: 'lamb', group: 'protein', tokens: ['red_meat', 'meat', 'animal_flesh'], regions: ['south_asian', 'middle_eastern'] },
  { name: 'goat', group: 'protein', tokens: ['red_meat', 'meat', 'animal_flesh'], regions: ['south_asian', 'african'] },
  { name: 'salmon', group: 'protein', tokens: ['fish', 'animal_flesh'], regions: ['mediterranean', 'east_asian'] },
  { name: 'white fish (cod/tilapia)', group: 'protein', tokens: ['fish', 'animal_flesh'] },
  { name: 'shrimp', group: 'protein', tokens: ['shellfish', 'animal_flesh'], regions: ['east_asian', 'latin'] },
  { name: 'eggs', group: 'protein', tokens: ['eggs'] },
  { name: 'tofu', group: 'protein', tokens: ['soy'], regions: ['east_asian'] },
  { name: 'tempeh', group: 'protein', tokens: ['soy'], regions: ['east_asian'] },
  { name: 'paneer', group: 'protein', tokens: ['dairy', 'lactose'], regions: ['south_asian'] },
  { name: 'greek yogurt', group: 'protein', tokens: ['dairy', 'lactose'], regions: ['mediterranean', 'middle_eastern'] },
  // Legumes (also protein sources)
  { name: 'lentils', group: 'legume', tokens: ['legumes'], regions: ['south_asian', 'middle_eastern'] },
  { name: 'chickpeas', group: 'legume', tokens: ['legumes'], regions: ['middle_eastern', 'mediterranean'] },
  { name: 'black beans', group: 'legume', tokens: ['legumes'], regions: ['latin'] },
  { name: 'kidney beans', group: 'legume', tokens: ['legumes'], regions: ['south_asian', 'latin'] },
  // Grains
  { name: 'white rice', group: 'grain', tokens: ['grains', 'starchy', 'refined_carbs'], regions: ['east_asian', 'south_asian', 'latin'] },
  { name: 'brown rice', group: 'grain', tokens: ['grains', 'starchy'] },
  { name: 'quinoa', group: 'grain', tokens: ['grains'], regions: ['latin'] },
  { name: 'oats', group: 'grain', tokens: ['grains'] },
  { name: 'whole wheat bread', group: 'grain', tokens: ['wheat', 'gluten', 'grains', 'starchy'] },
  { name: 'pasta', group: 'grain', tokens: ['wheat', 'gluten', 'grains', 'starchy'], regions: ['mediterranean'] },
  { name: 'corn tortilla', group: 'grain', tokens: ['corn', 'grains', 'starchy'], regions: ['latin'] },
  { name: 'potato', group: 'vegetable', tokens: ['starchy', 'nightshades', 'root_vegetables', 'high_potassium'] },
  // Oils & fats
  { name: 'olive oil', group: 'oil', tokens: [], regions: ['mediterranean', 'middle_eastern'] },
  { name: 'canola oil', group: 'oil', tokens: [] },
  { name: 'coconut oil', group: 'oil', tokens: [], regions: ['south_asian', 'east_asian'] },
  { name: 'sesame oil', group: 'oil', tokens: ['sesame'], regions: ['east_asian'] },
  { name: 'ghee', group: 'oil', tokens: ['dairy', 'lactose'], regions: ['south_asian'] },
  { name: 'butter', group: 'oil', tokens: ['dairy', 'lactose'] },
  // Vegetables
  { name: 'spinach', group: 'vegetable', tokens: ['high_potassium'] },
  { name: 'broccoli', group: 'vegetable', tokens: [] },
  { name: 'carrot', group: 'vegetable', tokens: ['root_vegetables'] },
  { name: 'cauliflower', group: 'vegetable', tokens: [] },
  { name: 'zucchini', group: 'vegetable', tokens: [] },
  { name: 'cucumber', group: 'vegetable', tokens: [] },
  { name: 'tomato', group: 'vegetable', tokens: ['nightshades'] },
  { name: 'bell pepper', group: 'vegetable', tokens: ['nightshades'] },
  { name: 'onion', group: 'vegetable', tokens: ['onion', 'allium', 'root_vegetables'] },
  { name: 'garlic', group: 'vegetable', tokens: ['garlic', 'allium', 'root_vegetables'] },
];

export interface RegionInfo {
  region: Region;
  label: string;
  /** Hint passed to the model to flavor the cuisine. */
  hint: string;
}

export const REGIONS: Record<Region, RegionInfo> = {
  south_asian: { region: 'south_asian', label: 'South Asian', hint: 'Lean into South Asian flavors: dals, curries, rice, roti, spice blends.' },
  middle_eastern: { region: 'middle_eastern', label: 'Middle Eastern', hint: 'Lean into Middle Eastern flavors: legumes, grilled meats, tahini, herbs, flatbread.' },
  mediterranean: { region: 'mediterranean', label: 'Mediterranean', hint: 'Lean into Mediterranean flavors: olive oil, fish, vegetables, legumes, whole grains.' },
  east_asian: { region: 'east_asian', label: 'East Asian', hint: 'Lean into East Asian flavors: rice, stir-fries, tofu, ginger, light broths.' },
  latin: { region: 'latin', label: 'Latin American', hint: 'Lean into Latin American flavors: beans, rice, corn, peppers, fresh salsas.' },
  african: { region: 'african', label: 'African', hint: 'Lean into African flavors: stews, grains, legumes, bold spices.' },
  none: { region: 'none', label: 'No preference', hint: 'Use familiar, widely-available everyday ingredients.' },
};

/* ================================================================== */
/* 3. Ingredient lexicon — keyword → token (the safety net)           */
/* ================================================================== */

export interface LexiconRule {
  re: RegExp;
  tokens: Token[];
}

/**
 * OVERRIDES run first and are CONSUMED (removed) from the working string so a
 * later single-word rule cannot re-tag them. This is how we stop "almond milk"
 * from being flagged as dairy, or miss that "soy sauce" also contains wheat.
 */
export const LEXICON_OVERRIDES: LexiconRule[] = [
  { re: /\b(almond|cashew|hazelnut|pistachio|macadamia)\s+milk\b/, tokens: ['tree_nuts'] },
  { re: /\bsoy(a)?\s+milk\b/, tokens: ['soy'] },
  { re: /\boat\s+milk\b/, tokens: ['grains'] },
  { re: /\bcoconut\s+milk\b/, tokens: ['coconut'] },
  { re: /\brice\s+milk\b/, tokens: ['grains'] },
  { re: /\b(almond|cashew|hazelnut)\s+(butter|flour)\b/, tokens: ['tree_nuts'] },
  { re: /\bpeanut\s+(butter|oil)\b/, tokens: ['peanuts'] },
  { re: /\b(rice|chickpea|gram|tapioca|coconut)\s+flour\b/, tokens: ['grains'] },
  { re: /\bcorn\s+flour\b/, tokens: ['corn', 'grains'] },
  { re: /\bsoy(a)?\s+sauce\b/, tokens: ['soy', 'wheat', 'gluten', 'high_sodium'] },
  { re: /\bfish\s+sauce\b/, tokens: ['fish', 'high_sodium'] },
  { re: /\boyster\s+sauce\b/, tokens: ['shellfish', 'high_sodium'] },
  { re: /\bworcestershire\b/, tokens: ['fish'] },
  { re: /\bcaesar\b/, tokens: ['fish', 'eggs', 'dairy', 'lactose'] },
  { re: /\bcooking\s+wine\b/, tokens: ['alcohol'] },
  { re: /\b(black|white)\s+pepper\b/, tokens: [] }, // NOT a nightshade — consume before 'pepper'
  { re: /\bdeli\s+meat\b|\bcold\s+cuts?\b/, tokens: ['deli_meat', 'meat', 'animal_flesh', 'processed'] },
];

export const INGREDIENT_LEXICON: LexiconRule[] = [
  // Pork & cured pork
  { re: /\b(pork|bacon|ham|prosciutto|pancetta|gammon|pepperoni|chorizo|salami)\b/, tokens: ['pork', 'red_meat', 'meat', 'animal_flesh'] },
  { re: /\blard\b/, tokens: ['lard', 'pork', 'animal_flesh'] },
  // Beef & red meat
  { re: /\b(beef|steak|veal|brisket|mince|ground beef)\b/, tokens: ['beef', 'red_meat', 'meat', 'animal_flesh'] },
  { re: /\b(lamb|mutton|goat)\b/, tokens: ['red_meat', 'meat', 'animal_flesh'] },
  // Poultry
  { re: /\b(chicken|turkey|duck|poultry|hen)\b/, tokens: ['poultry', 'meat', 'animal_flesh'] },
  // Generic meat / sausage (species unknown)
  { re: /\b(sausage|meatball|meat)\b/, tokens: ['meat', 'animal_flesh'] },
  { re: /\bgelatin(e)?\b/, tokens: ['gelatin', 'animal_flesh'] },
  // Finfish (high-mercury subset gets an extra token)
  { re: /\b(tuna|swordfish|shark|marlin|king mackerel)\b/, tokens: ['fish', 'animal_flesh', 'high_mercury_fish'] },
  { re: /\b(salmon|cod|tilapia|haddock|trout|sardine|mackerel|herring|anchovy|halibut|bass|fish)\b/, tokens: ['fish', 'animal_flesh'] },
  // Shellfish
  { re: /\b(shrimp|prawn|crab|lobster|clam|oyster|mussel|scallop|squid|calamari|crayfish|shellfish)\b/, tokens: ['shellfish', 'animal_flesh'] },
  // Dairy
  { re: /\b(milk|cream|cheese|butter|yogurt|yoghurt|paneer|ghee|curd|whey|custard|cheddar|mozzarella|parmesan|ricotta|feta|gouda)\b/, tokens: ['dairy', 'lactose'] },
  // Eggs
  { re: /\b(egg|eggs|omelet|omelette|mayonnaise|mayo|meringue|albumen)\b/, tokens: ['eggs'] },
  // Gluten grains
  { re: /\b(wheat|bread|pasta|noodle|couscous|bulgur|semolina|cracker|breadcrumb|pita|naan|roti|chapati|bagel|seitan|flour)\b/, tokens: ['wheat', 'gluten', 'grains'] },
  { re: /\b(barley|malt)\b/, tokens: ['barley', 'gluten', 'grains'] },
  { re: /\brye\b/, tokens: ['rye', 'gluten', 'grains'] },
  { re: /\b(oats|oatmeal)\b/, tokens: ['grains'] },
  { re: /\b(rice|quinoa)\b/, tokens: ['grains'] },
  // Soy
  { re: /\b(soy|soya|tofu|edamame|tempeh|miso|natto|tamari)\b/, tokens: ['soy'] },
  // Peanuts
  { re: /\bpeanut(s)?\b/, tokens: ['peanuts', 'legumes'] },
  // Tree nuts
  { re: /\b(almond|cashew|walnut|pecan|pistachio|hazelnut|macadamia|brazil nut|pine nut|praline|marzipan|nutella)\b/, tokens: ['tree_nuts'] },
  // Sesame
  { re: /\b(sesame|tahini|halva)\b/, tokens: ['sesame'] },
  { re: /\bhummus\b/, tokens: ['sesame', 'legumes'] },
  // Corn
  { re: /\b(corn|maize|polenta|cornstarch|cornmeal|grits|hominy)\b/, tokens: ['corn', 'grains'] },
  // Mustard
  { re: /\bmustard\b/, tokens: ['mustard'] },
  // Nightshades
  { re: /\b(tomato|eggplant|aubergine|paprika|cayenne|chil(l)?i)\b/, tokens: ['nightshades'] },
  { re: /\bbell pepper\b/, tokens: ['nightshades'] },
  { re: /\bpotato\b/, tokens: ['nightshades', 'starchy', 'root_vegetables', 'high_potassium'] },
  // Alliums & roots
  { re: /\b(onion|shallot|leek|scallion|chive)\b/, tokens: ['onion', 'allium', 'root_vegetables'] },
  { re: /\bgarlic\b/, tokens: ['garlic', 'allium', 'root_vegetables'] },
  { re: /\b(carrot|beet|turnip|radish|ginger)\b/, tokens: ['root_vegetables'] },
  // Legumes
  { re: /\b(lentil|chickpea|garbanzo|bean|dal|dahl|pea)\b/, tokens: ['legumes'] },
  // Alcohol
  { re: /\b(wine|beer|rum|vodka|whiskey|whisky|brandy|sake|mirin|sherry|liquor|liqueur|bourbon|tequila|vermouth)\b/, tokens: ['alcohol'] },
  // Sweeteners
  { re: /\bhoney\b/, tokens: ['honey'] },
  { re: /\b(sugar|syrup|molasses|candy)\b/, tokens: ['added_sugar'] },
  // Caffeine
  { re: /\b(coffee|espresso|mocha)\b/, tokens: ['coffee', 'caffeine'] },
  { re: /\b(tea|matcha)\b/, tokens: ['tea', 'caffeine'] },
  { re: /\b(cola|chocolate|cocoa)\b/, tokens: ['caffeine'] },
  // Preparation flags (prenatal / cardiac safety)
  { re: /\b(sushi|sashimi|tartare|carpaccio|ceviche)\b/, tokens: ['raw_fish', 'fish', 'animal_flesh'] },
  { re: /\braw\s+egg\b|\brunny\s+egg\b/, tokens: ['raw_egg', 'eggs'] },
  { re: /\b(unpasteurized|unpasteurised|raw milk)\b/, tokens: ['unpasteurized'] },
  { re: /\b(pickled|cured|canned|smoked)\b/, tokens: ['high_sodium', 'processed'] },
  { re: /\bsulfite(s)?\b/, tokens: ['sulfites'] },
];
