/**
 * Cuisine library — turns the engine's SAFE pantry (proteins/grains/veg that
 * already passed the constraint filter) into region-appropriate DISHES, not
 * generic Western templates. This is what makes a South Asian household get
 * karahi, daal and biryani instead of "traybake".
 *
 * Important safety note: every flavor ingredient a style wants to add (onion,
 * garlic, tomato, yogurt, chili…) carries lexicon tokens, so it is passed
 * through the caller's `isSafe` predicate before it can enter a meal. Pure
 * spices (cumin, turmeric, garam masala…) carry NO tokens and are always safe.
 * The dish names + recipe steps are presentation only — the deterministic
 * `validatePlan` pass still has the final word on the assembled ingredients.
 */

import type { MealSlot, Recipe, Region } from '@/types';

/* ------------------------------------------------------------------ */
/* Dish blueprints                                                    */
/* ------------------------------------------------------------------ */

interface DishStyle {
  /** Whether this style suits the given protein. Defaults to true. */
  suits?: (protein: string, isLegume: boolean) => boolean;
  name: (p: string, g: string, v: string) => string;
  /** Flavor items that carry allergen/diet tokens — SAFETY-FILTERED by caller. */
  aromatics: string[];
  /** Pure spices/herbs — no lexicon tokens, always safe. */
  spices: string[];
  steps: (ctx: StepCtx) => string[];
}

interface StepCtx {
  p: string; // protein
  g: string; // grain
  v: string; // vegetable 1
  v2: string; // vegetable 2
  fat: string; // oil/fat
  aromatics: string; // already-filtered, comma-joined (or a safe fallback)
  spices: string; // comma-joined spice list
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* --- South Asian: the richest set (the founder's home market) ------ */

const SOUTH_ASIAN: DishStyle[] = [
  {
    name: (p, _g, _v) => `${cap(p)} karahi`,
    suits: (_p, isLegume) => !isLegume,
    aromatics: ['onion', 'garlic', 'ginger', 'tomatoes', 'green chili'],
    spices: ['cumin', 'coriander', 'turmeric', 'garam masala'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Heat ${fat} in a heavy pan or karahi over medium-high heat.`,
      `Fry ${aromatics} until softened and fragrant, 5–6 minutes.`,
      `Stir in ${spices}, then add the ${p} and sear until coloured on all sides.`,
      `Add ${v} and a splash of water, cover, and simmer until the ${p} is tender, 18–25 minutes.`,
      `Uncover and reduce until the masala clings to the ${p}.`,
      `Finish with fresh coriander and serve hot with ${g}.`,
    ],
  },
  {
    name: (p, g, _v) => `${cap(p)} biryani with ${g}`,
    suits: (_p, isLegume) => !isLegume,
    aromatics: ['onion', 'garlic', 'ginger', 'yogurt', 'green chili'],
    spices: ['biryani masala', 'cardamom', 'cinnamon', 'bay leaf', 'turmeric'],
    steps: ({ p, g, fat, aromatics, spices }) => [
      `Par-boil the ${g} with whole ${spices} until 70% cooked, then drain.`,
      `In ${fat}, brown ${aromatics} into a deep golden masala.`,
      `Add the ${p} and cook until just done, seasoning well.`,
      `Layer the ${p} masala and the par-cooked ${g} in a heavy pot.`,
      `Cover tightly and steam on the lowest heat (dum) for 20 minutes.`,
      `Fluff gently and serve with a side of raita or salad.`,
    ],
  },
  {
    name: (p, _g, _v) => `Tarka ${p}`,
    suits: (_p, isLegume) => isLegume,
    aromatics: ['onion', 'garlic', 'ginger', 'tomatoes', 'green chili'],
    spices: ['cumin', 'turmeric', 'red chili powder', 'coriander'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Rinse the ${p} and boil with turmeric and salt until soft and creamy.`,
      `Lightly mash to your preferred texture and keep warm.`,
      `For the tarka, heat ${fat} and fry ${aromatics} until deep golden.`,
      `Add ${spices} and let them sizzle for 30 seconds.`,
      `Pour the tarka over the ${p} and stir through ${v}.`,
      `Serve with ${g} and a wedge of lemon.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} sabzi`,
    aromatics: ['onion', 'garlic', 'ginger', 'tomatoes'],
    spices: ['cumin', 'turmeric', 'coriander', 'garam masala'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Heat ${fat} and crackle cumin seeds, then add ${aromatics}.`,
      `Cook the masala down until the oil separates.`,
      `Add ${v} and ${v2}, tossing to coat in ${spices}.`,
      `Cover and steam-cook on low until just tender, stirring occasionally.`,
      `Adjust salt and finish with coriander.`,
      `Serve with warm ${g}.`,
    ],
  },
  {
    name: (p, _g, _v) => `${cap(p)} pulao`,
    suits: (_p, isLegume) => !isLegume,
    aromatics: ['onion', 'garlic', 'ginger'],
    spices: ['cumin', 'cardamom', 'cinnamon', 'cloves', 'bay leaf'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `In ${fat}, gently fry whole ${spices} until aromatic.`,
      `Add ${aromatics} and cook until soft and golden.`,
      `Stir in the ${p} and ${v}, browning lightly.`,
      `Add the rinsed ${g} and twice its volume of water; season generously.`,
      `Bring to a boil, then cover and steam on low until the ${g} is fluffy.`,
      `Rest 5 minutes, fork through, and serve.`,
    ],
  },
];

/* --- Other regions: solid 3-style sets ----------------------------- */

const MIDDLE_EASTERN: DishStyle[] = [
  {
    name: (p, _g, _v) => `Spiced ${p} with herbed ${'grain'}`,
    aromatics: ['onion', 'garlic'],
    spices: ['cumin', 'coriander', 'cinnamon', 'sumac'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Toss the ${p} with ${spices} and a little ${fat}.`,
      `Sear or roast until caramelised at the edges.`,
      `Soften ${aromatics} and stir through ${v}.`,
      `Fold everything through warm ${g}.`,
      `Finish with chopped parsley and a squeeze of lemon.`,
    ],
  },
  {
    name: (p, _g, _v) => `${cap(p)} & chickpea stew`,
    aromatics: ['onion', 'garlic', 'tomatoes'],
    spices: ['cumin', 'paprika', 'coriander', 'cinnamon'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Sauté ${aromatics} in ${fat} until jammy.`,
      `Add ${spices} and bloom for a minute.`,
      `Add the ${p}, ${v} and a little water; simmer until tender.`,
      `Season and finish with herbs.`,
      `Serve with ${g} or flatbread.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & tahini grain bowl`,
    aromatics: ['garlic'],
    spices: ['cumin', 'sumac', 'za’atar'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Roast ${v} and ${v2} with ${fat} and ${spices} until tender.`,
      `Whisk a tahini–lemon dressing with ${aromatics}.`,
      `Spoon the vegetables over ${g}.`,
      `Drizzle generously with the dressing.`,
      `Top with herbs and toasted seeds.`,
    ],
  },
];

const MEDITERRANEAN: DishStyle[] = [
  {
    name: (p, _g, _v) => `${cap(p)} with lemon & olive oil`,
    aromatics: ['garlic', 'tomatoes'],
    spices: ['oregano', 'black pepper', 'thyme'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Marinate the ${p} in ${fat}, lemon and ${spices}.`,
      `Sear until golden and just cooked through.`,
      `Warm ${aromatics} and ${v} in the same pan.`,
      `Plate over ${g}.`,
      `Finish with extra olive oil and herbs.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & white-bean ragout`,
    aromatics: ['onion', 'garlic', 'tomatoes'],
    spices: ['oregano', 'bay leaf', 'black pepper'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Soften ${aromatics} in ${fat}.`,
      `Add ${spices}, ${v} and ${v2}.`,
      `Simmer with the beans until thick and silky.`,
      `Season well.`,
      `Serve with ${g} and crusty bread.`,
    ],
  },
  {
    name: (p, g, _v) => `Baked ${p} & ${g}`,
    aromatics: ['garlic', 'tomatoes'],
    spices: ['oregano', 'rosemary', 'black pepper'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Layer ${g}, ${v} and ${aromatics} in a baking dish.`,
      `Nestle in the ${p}, drizzle with ${fat} and ${spices}.`,
      `Bake until everything is tender and golden.`,
      `Rest briefly.`,
      `Serve straight from the dish.`,
    ],
  },
];

const EAST_ASIAN: DishStyle[] = [
  {
    name: (p, _g, _v) => `Ginger ${p} stir-fry`,
    aromatics: ['garlic', 'ginger', 'scallion'],
    spices: ['white pepper', 'five-spice'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Heat ${fat} in a wok until shimmering.`,
      `Flash-fry ${aromatics} for 20 seconds.`,
      `Add the ${p} and stir-fry until nearly done.`,
      `Toss in ${v} and ${v2} with ${spices}; keep everything moving.`,
      `Serve immediately over ${g}.`,
    ],
  },
  {
    name: (p, _g, _v) => `${cap(p)} & vegetable claypot`,
    aromatics: ['garlic', 'ginger'],
    spices: ['white pepper', 'star anise'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Brown the ${p} in ${fat}.`,
      `Add ${aromatics}, ${spices} and a little water.`,
      `Add ${v} and simmer gently until tender.`,
      `Reduce to a glossy sauce.`,
      `Serve over ${g}.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & tofu rice bowl`,
    aromatics: ['garlic', 'ginger', 'scallion'],
    spices: ['white pepper'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Pan-fry tofu in ${fat} until golden on all sides.`,
      `Stir-fry ${aromatics} with ${v} and ${v2}.`,
      `Season with ${spices}.`,
      `Pile over steamed ${g}.`,
      `Finish with sliced scallion.`,
    ],
  },
];

const LATIN: DishStyle[] = [
  {
    name: (p, _g, _v) => `${cap(p)} & black-bean bowl`,
    aromatics: ['onion', 'garlic', 'tomatoes'],
    spices: ['cumin', 'smoked paprika', 'oregano'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Sauté ${aromatics} in ${fat} with ${spices}.`,
      `Add the ${p} and cook through.`,
      `Warm the beans and ${v} alongside.`,
      `Build bowls over ${g}.`,
      `Top with fresh salsa, coriander and lime.`,
    ],
  },
  {
    name: (p, _g, _v) => `${cap(p)} tinga`,
    aromatics: ['onion', 'garlic', 'tomatoes'],
    spices: ['cumin', 'oregano', 'smoked paprika'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Cook and shred the ${p}.`,
      `Blend ${aromatics} with ${spices} into a smoky sauce.`,
      `Simmer the ${p} and ${v} in the sauce.`,
      `Warm the ${g} (tortillas or rice).`,
      `Serve with lime and coriander.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & corn sauté`,
    aromatics: ['onion', 'garlic'],
    spices: ['cumin', 'oregano'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Char ${v} and ${v2} in a hot pan with ${fat}.`,
      `Add ${aromatics} and ${spices}.`,
      `Fold through the beans and corn.`,
      `Finish with lime.`,
      `Serve with ${g}.`,
    ],
  },
];

const AFRICAN: DishStyle[] = [
  {
    name: (p, _g, _v) => `${cap(p)} & peanut stew`,
    aromatics: ['onion', 'garlic', 'ginger', 'tomatoes'],
    spices: ['cumin', 'coriander', 'paprika'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Build a base of ${aromatics} in ${fat}.`,
      `Add ${spices} and the ${p}.`,
      `Stir in ${v} and simmer until rich and tender.`,
      `Season generously.`,
      `Serve over ${g}.`,
    ],
  },
  {
    name: (p, _g, _v) => `Berbere-spiced ${p}`,
    aromatics: ['onion', 'garlic', 'ginger'],
    spices: ['berbere', 'cardamom', 'cumin'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Slow-cook ${aromatics} in ${fat} until jammy.`,
      `Add ${spices} and bloom.`,
      `Add the ${p} and ${v}; simmer until tender.`,
      `Adjust seasoning.`,
      `Serve with ${g}.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & lentil pot`,
    aromatics: ['onion', 'garlic', 'tomatoes'],
    spices: ['cumin', 'turmeric', 'coriander'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Sauté ${aromatics} in ${fat}.`,
      `Add ${spices}, the lentils, ${v} and ${v2}.`,
      `Simmer until everything is soft.`,
      `Season and finish with herbs.`,
      `Serve with ${g}.`,
    ],
  },
];

/* --- Global fallback (region 'none' / unmatched) ------------------- */

const GLOBAL: DishStyle[] = [
  {
    name: (p, _g, v) => `${cap(p)} traybake with ${v}`,
    aromatics: ['garlic', 'onion'],
    spices: ['black pepper', 'thyme', 'paprika'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Heat the oven and spread ${v}, ${v2} and ${aromatics} on a tray.`,
      `Toss with ${fat} and ${spices}.`,
      `Nestle in the ${p} and roast until cooked through and golden.`,
      `Rest a few minutes.`,
      `Serve with ${g}.`,
    ],
  },
  {
    name: (g, _g2, p) => `${cap(p)} & ${g} stir-fry`,
    aromatics: ['garlic', 'onion'],
    spices: ['black pepper'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Heat ${fat} in a large pan.`,
      `Stir-fry ${aromatics} briefly.`,
      `Add the ${p} and cook until nearly done.`,
      `Add ${v} and ${v2} with ${spices}; toss until crisp-tender.`,
      `Serve over ${g}.`,
    ],
  },
  {
    name: (p, g, _v) => `${cap(p)} & ${g} bowl`,
    aromatics: ['garlic'],
    spices: ['black pepper', 'cumin'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Cook the ${g} and keep warm.`,
      `Season and pan-cook the ${p} in ${fat} with ${aromatics}.`,
      `Quickly sauté ${v} and ${v2} with ${spices}.`,
      `Build bowls of ${g}, ${p} and vegetables.`,
      `Add a dressing or sauce of choice.`,
    ],
  },
  {
    name: (p, _g, v) => `Herbed ${p} soup with ${v}`,
    aromatics: ['onion', 'garlic'],
    spices: ['black pepper', 'bay leaf', 'thyme'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Soften ${aromatics} in ${fat}.`,
      `Add ${spices}, the ${p}, ${v} and ${v2}.`,
      `Cover with stock and simmer until tender.`,
      `Season to taste.`,
      `Serve with ${g} on the side.`,
    ],
  },
];

const STYLES_BY_REGION: Record<Region, DishStyle[]> = {
  south_asian: SOUTH_ASIAN,
  middle_eastern: MIDDLE_EASTERN,
  mediterranean: MEDITERRANEAN,
  east_asian: EAST_ASIAN,
  latin: LATIN,
  african: AFRICAN,
  none: GLOBAL,
};

/* --- Breakfasts: a South Asian set + a global set ------------------ */

// Breakfast blueprints use the same ${p}/${g}/${v} placeholders as the mains so
// the name, steps and ingredient list always agree (no "whisk eggs" when the
// protein is lamb). mockPlan biases the breakfast protein toward eggs when the
// household allows them, so these usually read as anda/egg dishes.
const SOUTH_ASIAN_BREAKFAST: DishStyle[] = [
  {
    name: (p, _g, _v) => `${cap(p)} bhurji`,
    aromatics: ['onion', 'green chili', 'tomatoes'],
    spices: ['cumin', 'red chili powder', 'coriander'],
    steps: ({ p, g, fat, aromatics, spices }) => [
      `Heat ${fat} and fry ${aromatics} until soft.`,
      `Stir in ${spices}, then add the ${p}.`,
      `Cook into a soft, spiced bhurji (scramble).`,
      `Warm the ${g} (paratha, roti or toast).`,
      `Serve hot with chai.`,
    ],
  },
  {
    name: (p, _g, v) => `Masala ${p} with ${v}`,
    aromatics: ['onion', 'ginger', 'tomatoes'],
    spices: ['cumin', 'turmeric', 'garam masala'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Sauté ${aromatics} in ${fat} until soft.`,
      `Add ${spices} and the ${p} with a splash of water.`,
      `Stir through ${v} and simmer until thick.`,
      `Warm the ${g}.`,
      `Serve together, topped with coriander.`,
    ],
  },
  {
    name: (_p, g, _v) => `Spiced ${g} porridge`,
    aromatics: [],
    spices: ['cardamom', 'cinnamon'],
    steps: ({ g, spices }) => [
      `Simmer the ${g} with milk (or a dairy-free alternative) and ${spices}.`,
      `Cook low and slow until creamy.`,
      `Sweeten lightly to taste.`,
      `Top with fruit if allowed.`,
      `Serve warm.`,
    ],
  },
];

const GLOBAL_BREAKFAST: DishStyle[] = [
  {
    name: (p, _g, v) => `${cap(p)} & ${v} scramble`,
    aromatics: ['onion', 'tomatoes'],
    spices: ['black pepper'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Soften ${aromatics} and ${v} in ${fat}.`,
      `Add the ${p} and ${spices}.`,
      `Cook gently until just set.`,
      `Serve with the ${g} (toast or flatbread).`,
    ],
  },
  {
    name: (_p, g, _v) => `${cap(g)} breakfast bowl`,
    aromatics: [],
    spices: ['cinnamon'],
    steps: ({ g, spices }) => [
      `Cook the ${g} with milk or water and ${spices}.`,
      `Simmer until soft and creamy.`,
      `Top with fruit or seeds if allowed.`,
      `Serve warm.`,
    ],
  },
  {
    name: (p, _g, v) => `${cap(v)} & ${p} plate`,
    aromatics: ['garlic'],
    spices: ['black pepper'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Sauté ${v} and ${v2} with ${aromatics} in ${fat}.`,
      `Cook the ${p} alongside, seasoned with ${spices}.`,
      `Plate together.`,
      `Serve with the ${g}.`,
    ],
  },
];

const BREAKFAST_BY_REGION: Partial<Record<Region, DishStyle[]>> = {
  south_asian: SOUTH_ASIAN_BREAKFAST,
};

const CUISINE_LABEL: Record<Region, string> = {
  south_asian: 'South Asian',
  middle_eastern: 'Middle Eastern',
  mediterranean: 'Mediterranean',
  east_asian: 'East Asian',
  latin: 'Latin American',
  african: 'African',
  none: 'Everyday',
};

/* ------------------------------------------------------------------ */
/* Public: build one regional meal from safe pantry items             */
/* ------------------------------------------------------------------ */

export interface RegionalMealInput {
  region: Region;
  slot: MealSlot;
  protein: string;
  grain: string;
  veg: string;
  veg2: string;
  fat: string;
  isLegume: boolean;
  seed: number;
  /** True if the flavor ingredient is safe for THIS household (hard-exclude check). */
  isSafe: (ingredient: string) => boolean;
}

export interface RegionalMeal {
  name: string;
  cuisine: string;
  /** Extra flavor ingredients that passed the safety check (added to the meal). */
  extras: string[];
  recipe: Recipe;
}

export function buildRegionalMeal(input: RegionalMealInput): RegionalMeal {
  const { region, slot, protein, grain, veg, veg2, fat, isLegume, seed, isSafe } = input;
  const styles =
    slot === 'breakfast'
      ? BREAKFAST_BY_REGION[region] ?? GLOBAL_BREAKFAST
      : STYLES_BY_REGION[region] ?? GLOBAL;

  // Prefer a style that suits this protein (e.g. legume-only dishes for lentils).
  const suited = styles.filter((s) => (s.suits ? s.suits(protein, isLegume) : true));
  const pool = suited.length ? suited : styles;
  const style = pool[seed % pool.length];

  const safeAromatics = style.aromatics.filter(isSafe);
  const aromaticsText = safeAromatics.length ? joinList(safeAromatics) : `a little extra ${fat}`;
  const spicesText = joinList(style.spices);

  const ctx: StepCtx = { p: protein, g: grain, v: veg, v2: veg2, fat, aromatics: aromaticsText, spices: spicesText };

  return {
    name: style.name(protein, grain, veg),
    cuisine: CUISINE_LABEL[region] ?? 'Everyday',
    extras: safeAromatics,
    recipe: {
      servings: 4,
      timeMinutes: 25 + (seed % 4) * 5,
      steps: style.steps(ctx),
    },
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* Food visuals — emoji + gradient tile (no network, always loads)    */
/* ------------------------------------------------------------------ */

type Visual = { emoji: string; colors: [string, string] };

const GRADIENTS: [string, string][] = [
  ['#F4A259', '#E76F51'], // warm amber → terracotta
  ['#2A9D8F', '#1F7A6E'], // teal green
  ['#E9C46A', '#E76F51'], // saffron → rust
  ['#577590', '#43586E'], // slate blue
  ['#84A98C', '#52796F'], // sage
  ['#BC6C25', '#9C5114'], // spice brown
  ['#5B8E7D', '#3E6E5E'], // herb green
  ['#C1486B', '#9B2F4E'], // pomegranate
];

const EMOJI_RULES: { re: RegExp; emoji: string }[] = [
  { re: /biryani|pulao|pilaf|rice bowl|fried rice/i, emoji: '🍛' },
  { re: /karahi|curry|tikka|masala|salan|stew|ragout|tinga|claypot|berbere/i, emoji: '🍛' },
  { re: /daal|dal|tarka|lentil|bean|chickpea/i, emoji: '🍲' },
  { re: /soup|broth|pot\b/i, emoji: '🥣' },
  { re: /stir-fry|noodle|claypot/i, emoji: '🍜' },
  { re: /sabzi|salad|bowl|vegetable|veg /i, emoji: '🥗' },
  { re: /traybake|baked|roast/i, emoji: '🍗' },
  { re: /taco|tortilla|wrap/i, emoji: '🌮' },
];

const PROTEIN_EMOJI: { re: RegExp; emoji: string }[] = [
  { re: /shrimp|prawn|crab|lobster|shellfish/i, emoji: '🦐' },
  { re: /salmon|fish|cod|tilapia|tuna/i, emoji: '🐟' },
  { re: /chicken|turkey|poultry/i, emoji: '🍗' },
  { re: /beef|lamb|goat|steak|mutton/i, emoji: '🥩' },
  { re: /egg/i, emoji: '🍳' },
  { re: /tofu|tempeh|paneer/i, emoji: '🥡' },
];

/** Deterministic emoji + gradient for a meal, from its name and ingredients. */
export function mealVisual(name: string, ingredients: string[]): Visual {
  const hay = `${name} ${ingredients.join(' ')}`;
  let emoji = '';
  for (const r of EMOJI_RULES) if (r.re.test(name)) { emoji = r.emoji; break; }
  if (!emoji) for (const r of PROTEIN_EMOJI) if (r.re.test(hay)) { emoji = r.emoji; break; }
  if (!emoji) emoji = '🍽️';

  // Stable hash so the same dish always gets the same tile colour.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { emoji, colors: GRADIENTS[h % GRADIENTS.length] };
}
