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
  /** Whether this style suits the given protein + grain. Defaults to true. */
  suits?: (protein: string, isLegume: boolean, grain: string) => boolean;
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

/** True for rice-family grains — guards rice-named dishes (biryani, pulao) from
 *  being built around an unrelated grain like oats, pasta or whole wheat bread. */
const isRiceLike = (grain: string) => /\brice\b/i.test(grain);

/* ------------------------------------------------------------------ */
/* Local-language food names (DISPLAY ONLY)                           */
/* ------------------------------------------------------------------ */

/**
 * Region → { canonical English (lowercase) : local name }. Used only to make
 * dish names, recipe steps and ingredient labels read in the household's own
 * food language (aloo, not potato). The constraint engine never sees these —
 * `ingredients` stay canonical English so the safety lexicon still matches.
 */
const LOCAL_NAMES: Partial<Record<Region, Record<string, string>>> = {
  south_asian: {
    chicken: 'murghi',
    lamb: 'gosht',
    goat: 'bakra',
    beef: 'beef',
    eggs: 'anday',
    'white fish (cod/tilapia)': 'machli',
    salmon: 'machli',
    shrimp: 'jhinga',
    lentils: 'daal',
    chickpeas: 'chanay',
    'kidney beans': 'rajma',
    'white rice': 'chawal',
    'brown rice': 'chawal',
    rice: 'chawal',
    'whole wheat bread': 'roti',
    bread: 'roti',
    potato: 'aloo',
    spinach: 'palak',
    cauliflower: 'gobi',
    carrot: 'gajar',
    zucchini: 'tori',
    cucumber: 'kheera',
    tomato: 'tamatar',
    tomatoes: 'tamatar',
    'bell pepper': 'shimla mirch',
    onion: 'pyaaz',
    garlic: 'lehsun',
    ginger: 'adrak',
    'green chili': 'hari mirch',
    yogurt: 'dahi',
    'greek yogurt': 'dahi',
    paneer: 'paneer',
    greens: 'saag',
    'seasonal vegetables': 'sabzi',
    'mixed beans': 'lobia',
  },
};

/** Localize a single canonical food name for display. Falls back to the original. */
export function localizeName(name: string, region: Region): string {
  const map = LOCAL_NAMES[region];
  if (!map) return name;
  return map[name.trim().toLowerCase()] ?? name;
}

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
    suits: (_p, isLegume, grain) => !isLegume && isRiceLike(grain),
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
    suits: (_p, isLegume, grain) => !isLegume && isRiceLike(grain),
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
    name: (p, g, _v) => `Spiced ${p} with herbed ${g}`,
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

const CHINESE: DishStyle[] = [
  {
    name: (p, _g, _v) => `${cap(p)} stir-fry`,
    aromatics: ['garlic', 'ginger', 'scallion'],
    spices: ['white pepper', 'five-spice'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Heat ${fat} in a wok over high heat until shimmering.`,
      `Flash-fry ${aromatics} for 20 seconds.`,
      `Add the ${p} and stir-fry until nearly cooked through.`,
      `Toss in ${v} and ${v2} with ${spices}; keep everything moving.`,
      `Finish with a splash of soy sauce and serve over ${g}.`,
    ],
  },
  {
    name: (p, _g, _v) => `Kung pao ${p}`,
    suits: (_p, isLegume) => !isLegume,
    aromatics: ['garlic', 'ginger', 'scallion'],
    spices: ['dried chili', 'five-spice', 'white pepper'],
    steps: ({ p, g, fat, aromatics, spices }) => [
      `Marinate the ${p} briefly, then sear in hot ${fat} until just done.`,
      `Push aside, fry ${aromatics} and ${spices} until fragrant.`,
      `Toss everything together with a savory-sweet sauce.`,
      `Stir through roasted peanuts if allowed.`,
      `Serve over steamed ${g}.`,
    ],
  },
  {
    name: (p, g, _v) => `${cap(p)} fried rice with ${g}`,
    suits: (_p, isLegume, grain) => !isLegume && isRiceLike(grain),
    aromatics: ['garlic', 'scallion', 'ginger'],
    spices: ['white pepper'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Use day-old ${g} so the grains stay separate when fried.`,
      `Heat ${fat} in a wok and scramble in egg if allowed.`,
      `Add ${aromatics} and the ${p}, stir-frying until done.`,
      `Toss in the ${g} and ${v}, breaking up clumps.`,
      `Season with soy sauce and ${spices}; serve hot.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & tofu claypot`,
    aromatics: ['garlic', 'ginger', 'scallion'],
    spices: ['white pepper', 'star anise'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Pan-fry tofu cubes in ${fat} until golden.`,
      `Add ${aromatics}, ${spices} and a little water or stock.`,
      `Stir in ${v} and ${v2}, simmering until tender.`,
      `Reduce to a glossy sauce.`,
      `Serve over steamed ${g}.`,
    ],
  },
];

const AMERICAN: DishStyle[] = [
  {
    name: (p, _g, _v) => `Skillet ${p} with roasted vegetables`,
    aromatics: ['onion', 'garlic'],
    spices: ['black pepper', 'paprika', 'thyme'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Season the ${p} with ${spices} and sear in ${fat} until golden.`,
      `Roast ${v} and ${v2} alongside until caramelised.`,
      `Soften ${aromatics} in the same pan for a quick pan sauce.`,
      `Plate the ${p} and vegetables together.`,
      `Serve with ${g} on the side.`,
    ],
  },
  {
    name: (p, _g, _v) => `BBQ-style ${p}`,
    aromatics: ['onion', 'garlic'],
    spices: ['smoked paprika', 'black pepper', 'brown sugar rub'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Rub the ${p} with ${spices} and let it sit 10 minutes.`,
      `Sear in ${fat} until well-charred on the outside.`,
      `Glaze with a smoky barbecue sauce, basting as it finishes cooking.`,
      `Warm ${aromatics} with ${v} as a quick side.`,
      `Serve with ${g} and extra sauce.`,
    ],
  },
  {
    name: (p, g, _v) => `${cap(p)} & ${g} casserole`,
    aromatics: ['onion', 'garlic'],
    spices: ['black pepper', 'thyme'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Brown the ${p} in ${fat} with ${aromatics}.`,
      `Layer with ${g}, ${v} and ${v2} in a baking dish.`,
      `Season with ${spices} and a splash of stock.`,
      `Bake until bubbling and golden on top.`,
      `Rest briefly before serving.`,
    ],
  },
  {
    name: (_p, _g, v) => `Loaded ${v} bowl`,
    aromatics: ['garlic', 'onion'],
    spices: ['black pepper', 'paprika'],
    steps: ({ p, g, v, v2, fat, aromatics, spices }) => [
      `Roast ${v} and ${v2} with ${fat} and ${spices}.`,
      `Pan-cook the ${p} with ${aromatics} until done.`,
      `Warm the ${g} and build the bowl.`,
      `Layer the roasted vegetables and ${p} on top.`,
      `Finish with a simple dressing of choice.`,
    ],
  },
];

const EUROPEAN: DishStyle[] = [
  {
    name: (p, _g, _v) => `Braised ${p} with herbs`,
    aromatics: ['onion', 'garlic'],
    spices: ['bay leaf', 'thyme', 'black pepper'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Brown the ${p} in ${fat}, then set aside.`,
      `Soften ${aromatics} in the same pot.`,
      `Return the ${p}, add ${v}, ${spices} and enough stock to cover.`,
      `Cover and braise low and slow until tender.`,
      `Serve with ${g} to soak up the sauce.`,
    ],
  },
  {
    name: (p, g, _v) => `Pan-roasted ${p} with ${g}`,
    aromatics: ['garlic', 'shallot'],
    spices: ['black pepper', 'rosemary', 'thyme'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Season the ${p} with ${spices} and sear in ${fat}.`,
      `Finish in the oven until cooked through.`,
      `Sauté ${aromatics} and ${v} in the same pan.`,
      `Rest the ${p} briefly before slicing.`,
      `Serve over ${g} with the pan vegetables.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & white-bean gratin`,
    aromatics: ['onion', 'garlic'],
    spices: ['thyme', 'black pepper', 'nutmeg'],
    steps: ({ g, v, v2, fat, aromatics, spices }) => [
      `Soften ${aromatics} in ${fat}.`,
      `Layer with ${v}, ${v2} and the beans in a baking dish.`,
      `Season with ${spices} and a little cream or stock.`,
      `Bake until tender and golden on top.`,
      `Serve with ${g} and crusty bread.`,
    ],
  },
  {
    name: (_p, g, v) => `${cap(g)} & ${v} soup`,
    aromatics: ['onion', 'garlic', 'leek'],
    spices: ['bay leaf', 'black pepper'],
    steps: ({ p, g, v, fat, aromatics, spices }) => [
      `Soften ${aromatics} in ${fat}.`,
      `Add the ${g}, ${v} and ${p}; cover with stock.`,
      `Simmer with ${spices} until everything is tender.`,
      `Blend partially or leave chunky, to taste.`,
      `Season and serve warm with bread.`,
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
  chinese: CHINESE,
  latin: LATIN,
  african: AFRICAN,
  american: AMERICAN,
  european: EUROPEAN,
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

/* --- Supper: LIGHT tea-time snacks, not a second dinner ------------- */

// "Supper" here is the evening chai/coffee bite — pakoray, chaat, a toastie,
// something small and quick — NOT a full rice-and-curry plate. These read as
// light snacks so the four daily slots aren't four heavy meals.
const SOUTH_ASIAN_SUPPER: DishStyle[] = [
  {
    name: (_p, _g, v) => `${cap(v)} pakoray`,
    aromatics: ['onion', 'green chili'],
    spices: ['cumin', 'coriander', 'red chili powder', 'turmeric'],
    steps: ({ v, v2, fat, aromatics, spices }) => [
      `Make a thick batter from gram flour, ${spices} and a splash of water.`,
      `Fold in thinly sliced ${v}, ${v2} and ${aromatics}.`,
      `Heat ${fat} for shallow-frying over medium heat.`,
      `Drop in spoonfuls and fry until golden and crisp.`,
      `Drain and serve hot with chutney and a cup of chai.`,
    ],
  },
  {
    name: (p, _g, _v) => `${cap(p)} chaat`,
    suits: (_p, isLegume) => isLegume,
    aromatics: ['onion', 'tomatoes', 'green chili'],
    spices: ['chaat masala', 'cumin', 'red chili powder'],
    steps: ({ p, aromatics, spices }) => [
      `Boil the ${p} until just tender, then drain and cool a little.`,
      `Toss with finely chopped ${aromatics}.`,
      `Sprinkle over ${spices} and a squeeze of lemon.`,
      `Top with a spoon of yoghurt and crisp sev if you like.`,
      `Serve in small bowls alongside evening chai.`,
    ],
  },
  {
    name: (_p, g, _v) => `Masala ${g} toast`,
    aromatics: ['onion', 'tomatoes', 'green chili'],
    spices: ['cumin', 'turmeric', 'chaat masala'],
    steps: ({ g, v, fat, aromatics, spices }) => [
      `Sauté ${aromatics} and ${v} in a little ${fat} with ${spices}.`,
      `Cook down into a soft, dry spiced topping.`,
      `Toast slices of ${g} until crisp.`,
      `Spoon the masala over and cut into halves.`,
      `Serve warm with chai or coffee.`,
    ],
  },
  {
    name: (p, _g, _v) => `${cap(p)} tikki`,
    aromatics: ['onion', 'green chili'],
    spices: ['cumin', 'coriander', 'garam masala'],
    steps: ({ p, v, fat, aromatics, spices }) => [
      `Mash the cooked ${p} with a little boiled potato to bind.`,
      `Mix in ${aromatics}, ${v} and ${spices}.`,
      `Shape into small flat tikki patties.`,
      `Shallow-fry in ${fat} until golden on both sides.`,
      `Serve hot with chutney and tea.`,
    ],
  },
];

const GLOBAL_SUPPER: DishStyle[] = [
  {
    name: (_p, _g, v) => `${cap(v)} toastie`,
    aromatics: ['tomatoes'],
    spices: ['black pepper'],
    steps: ({ g, v, fat, spices }) => [
      `Lightly butter slices of ${g} with ${fat}.`,
      `Layer ${v} and a little cheese between them.`,
      `Toast in a pan until golden and melting.`,
      `Season with ${spices}.`,
      `Halve and serve warm with tea or coffee.`,
    ],
  },
  {
    name: (_p, _g, v) => `${cap(v)} & dip plate`,
    aromatics: ['garlic'],
    spices: ['black pepper', 'paprika'],
    steps: ({ v, v2, fat, aromatics, spices }) => [
      `Whisk a quick dip from ${aromatics}, ${fat} and ${spices}.`,
      `Cut ${v} and ${v2} into sticks.`,
      `Arrange on a plate with a few crackers.`,
      `Spoon the dip alongside.`,
      `Serve as a light bite with coffee.`,
    ],
  },
  {
    name: (_p, _g, v) => `Quick ${v} fritters`,
    aromatics: ['onion'],
    spices: ['black pepper', 'paprika'],
    steps: ({ v, v2, fat, aromatics, spices }) => [
      `Grate ${v} and ${v2} and mix with ${aromatics} and a little flour.`,
      `Season with ${spices}.`,
      `Pan-fry small spoonfuls in ${fat} until crisp.`,
      `Drain on paper.`,
      `Serve warm with a dip and tea or coffee.`,
    ],
  },
];

const SUPPER_BY_REGION: Partial<Record<Region, DishStyle[]>> = {
  south_asian: SOUTH_ASIAN_SUPPER,
};

/* ------------------------------------------------------------------ */
/* Dessert — built from fruit + grain + sugar, never protein-driven    */
/* ------------------------------------------------------------------ */

interface DessertCtx {
  fruit: string;
  grain: string;
  aromatics: string; // already safety-filtered (e.g. yogurt, honey, cream)
  spices: string;
}

interface DessertStyle {
  name: (fruit: string, grain: string) => string;
  /** Dairy/sweetener extras that carry tokens — SAFETY-FILTERED by caller. */
  aromatics: string[];
  spices: string[];
  steps: (ctx: DessertCtx) => string[];
  /** Fruit-forward, no/low added sugar-and-dairy — preferred when the
   *  household is health-conscious (see buildRegionalDessert). */
  light?: boolean;
}

const GLOBAL_DESSERT: DessertStyle[] = [
  {
    name: (f) => `${cap(f)} & yogurt parfait`,
    aromatics: ['yogurt', 'honey'],
    spices: ['cinnamon'],
    steps: ({ fruit, aromatics, spices }) => [
      `Slice the ${fruit} into small pieces.`,
      `Layer it with ${aromatics} in a glass or bowl.`,
      `Dust with ${spices}.`,
      `Chill for 10 minutes before serving.`,
    ],
  },
  {
    name: (f, g) => `Warm ${g} pudding with ${f}`,
    aromatics: ['milk'],
    spices: ['cinnamon', 'cardamom'],
    steps: ({ grain, fruit, aromatics, spices }) => [
      `Simmer ${grain} gently in ${aromatics} with a spoon of sugar until creamy.`,
      `Stir in ${spices}.`,
      `Top with sliced ${fruit}.`,
      `Serve warm in small bowls.`,
    ],
  },
  {
    name: (f) => `Baked ${f} with honey`,
    aromatics: ['honey', 'butter'],
    spices: ['cinnamon'],
    steps: ({ fruit, aromatics, spices }) => [
      `Halve the ${fruit} and place in a baking dish.`,
      `Drizzle with ${aromatics} and a dust of ${spices}.`,
      `Bake until soft and caramelized at the edges.`,
      `Serve warm.`,
    ],
  },
  {
    name: (f) => `Fresh ${f} fruit salad`,
    aromatics: ['mint', 'honey'],
    spices: ['lime zest'],
    steps: ({ fruit, aromatics, spices }) => [
      `Chop the ${fruit} and any other fruit on hand into bite-size pieces.`,
      `Toss with ${aromatics} and a little ${spices}.`,
      `Chill for 10 minutes so the flavors mingle.`,
      `Serve in small bowls.`,
    ],
    light: true,
  },
];

const SOUTH_ASIAN_DESSERT: DessertStyle[] = [
  {
    name: (_f, g) => `${cap(g)} kheer`,
    aromatics: ['milk', 'ghee'],
    spices: ['cardamom', 'saffron'],
    steps: ({ grain, aromatics, spices }) => [
      `Simmer ${grain} in ${aromatics} on low heat, stirring often, until thick and creamy.`,
      `Sweeten with sugar to taste.`,
      `Stir in ${spices}.`,
      `Serve warm or chilled in small bowls.`,
    ],
  },
  {
    name: () => 'Semolina halwa',
    aromatics: ['ghee', 'milk'],
    spices: ['cardamom'],
    steps: ({ aromatics, spices }) => [
      `Toast semolina in ${aromatics} until lightly golden and fragrant.`,
      `Add sugar water gradually, stirring to avoid lumps.`,
      `Cook until it pulls away from the pan.`,
      `Finish with ${spices} and serve warm.`,
    ],
  },
];

const MIDDLE_EASTERN_DESSERT: DessertStyle[] = [
  {
    name: (f) => `${cap(f)} with honey and yogurt`,
    aromatics: ['yogurt', 'honey'],
    spices: ['cinnamon'],
    steps: ({ fruit, aromatics, spices }) => [
      `Slice the ${fruit} and arrange in a bowl.`,
      `Spoon over ${aromatics}.`,
      `Dust with ${spices}.`,
      `Serve at room temperature.`,
    ],
    light: true,
  },
];

const LATIN_DESSERT: DessertStyle[] = [
  {
    name: (f) => `Grilled ${f} with cinnamon sugar`,
    aromatics: ['butter'],
    spices: ['cinnamon'],
    light: true,
    steps: ({ fruit, aromatics, spices }) => [
      `Slice the ${fruit} and brush lightly with ${aromatics}.`,
      `Sear in a hot pan until caramelized.`,
      `Dust with sugar and ${spices}.`,
      `Serve warm.`,
    ],
  },
];

const DESSERT_BY_REGION: Partial<Record<Region, DessertStyle[]>> = {
  south_asian: SOUTH_ASIAN_DESSERT,
  middle_eastern: MIDDLE_EASTERN_DESSERT,
  latin: LATIN_DESSERT,
};

/* ------------------------------------------------------------------ */
/* Drinks — for the Surprise Me / Guests spread (appetizer/main/drink/  */
/* dessert), not part of the weekly plan's meal slots                  */
/* ------------------------------------------------------------------ */

interface DrinkCtx {
  aromatics: string;
  spices: string;
}

interface DrinkStyle {
  name: () => string;
  /** Dairy/fruit/citrus extras that carry tokens — SAFETY-FILTERED by caller. */
  aromatics: string[];
  spices: string[];
  steps: (ctx: DrinkCtx) => string[];
}

const GLOBAL_DRINKS: DrinkStyle[] = [
  {
    name: () => 'Iced lemon-mint cooler',
    aromatics: ['lemon', 'mint'],
    spices: ['sugar'],
    steps: ({ aromatics, spices }) => [
      `Juice the lemon and roughly tear the mint.`,
      `Stir both into a jug of cold water with ${spices} to taste.`,
      `Add ${aromatics} and stir well.`,
      `Pour over ice and serve.`,
    ],
  },
  {
    name: () => 'Ginger lemonade',
    aromatics: ['ginger', 'lemon'],
    spices: ['sugar'],
    steps: ({ aromatics, spices }) => [
      `Grate the ginger and steep briefly in warm water.`,
      `Stir in ${aromatics} and ${spices} to taste.`,
      `Chill, then pour over ice.`,
      `Garnish with a lemon slice.`,
    ],
  },
  {
    name: () => 'Sparkling fruit punch',
    aromatics: ['mixed berries', 'orange'],
    spices: ['sugar'],
    steps: ({ aromatics, spices }) => [
      `Muddle ${aromatics} lightly with ${spices}.`,
      `Top with chilled sparkling water.`,
      `Stir gently and pour over ice.`,
      `Garnish with extra fruit.`,
    ],
  },
];

const SOUTH_ASIAN_DRINKS: DrinkStyle[] = [
  {
    name: () => 'Mango lassi',
    aromatics: ['yogurt', 'mango'],
    spices: ['sugar', 'cardamom'],
    steps: ({ aromatics, spices }) => [
      `Blend ${aromatics} with a splash of cold water until smooth.`,
      `Sweeten with ${spices} to taste.`,
      `Pour over ice.`,
      `Serve chilled.`,
    ],
  },
  {
    name: () => 'Masala chai',
    aromatics: ['milk'],
    spices: ['cardamom', 'cinnamon', 'ginger'],
    steps: ({ aromatics, spices }) => [
      `Simmer water with tea leaves and ${spices}.`,
      `Add ${aromatics} and bring back to a gentle boil.`,
      `Sweeten with sugar to taste.`,
      `Strain and serve hot.`,
    ],
  },
];

const MIDDLE_EASTERN_DRINKS: DrinkStyle[] = [
  {
    name: () => 'Mint lemonade',
    aromatics: ['lemon', 'mint'],
    spices: ['sugar'],
    steps: ({ aromatics, spices }) => [
      `Blend ${aromatics} with cold water and ${spices} to taste.`,
      `Strain to remove pulp, if preferred.`,
      `Pour over ice.`,
      `Garnish with a mint sprig.`,
    ],
  },
];

const DRINK_BY_REGION: Partial<Record<Region, DrinkStyle[]>> = {
  south_asian: SOUTH_ASIAN_DRINKS,
  middle_eastern: MIDDLE_EASTERN_DRINKS,
};

const CUISINE_LABEL: Record<Region, string> = {
  south_asian: 'South Asian',
  middle_eastern: 'Middle Eastern',
  mediterranean: 'Mediterranean',
  east_asian: 'East Asian',
  chinese: 'Chinese',
  latin: 'Latin American',
  african: 'African',
  american: 'American',
  european: 'European',
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
      : slot === 'supper'
        ? SUPPER_BY_REGION[region] ?? GLOBAL_SUPPER
        : STYLES_BY_REGION[region] ?? GLOBAL;

  // Prefer a style that suits this protein + grain (e.g. legume-only dishes for
  // lentils; rice-only dishes for biryani/pulao, so "oats" never builds a biryani name).
  const suited = styles.filter((s) => (s.suits ? s.suits(protein, isLegume, grain) : true));
  const pool = suited.length ? suited : styles;
  const style = pool[seed % pool.length];

  const safeAromatics = style.aromatics.filter(isSafe);
  // Localize only the words shown to the user (name + steps); `extras` returned
  // for the ingredient list stay canonical so the safety engine still matches.
  const loc = (s: string) => localizeName(s, region);
  const lAromatics = safeAromatics.map(loc);
  const aromaticsText = lAromatics.length ? joinList(lAromatics) : `a little extra ${loc(fat)}`;
  const spicesText = joinList(style.spices);

  const ctx: StepCtx = {
    p: loc(protein),
    g: loc(grain),
    v: loc(veg),
    v2: loc(veg2),
    fat: loc(fat),
    aromatics: aromaticsText,
    spices: spicesText,
  };

  // Tea-time supper and breakfast are quick; lunch/dinner take a bit longer.
  const light = slot === 'supper' || slot === 'breakfast';
  return {
    name: style.name(loc(protein), loc(grain), loc(veg)),
    cuisine: CUISINE_LABEL[region] ?? 'Everyday',
    extras: safeAromatics,
    recipe: {
      servings: 4,
      timeMinutes: light ? 15 + (seed % 3) * 5 : 25 + (seed % 4) * 5,
      steps: style.steps(ctx),
    },
  };
}

export interface RegionalDessertInput {
  region: Region;
  fruit: string;
  grain: string;
  seed: number;
  isSafe: (ingredient: string) => boolean;
  /** Household's 1-5 health-consciousness scale — >=4 prefers `light` (fruit-
   *  forward, low added sugar/dairy) styles over richer ones like halwa/kheer. */
  healthConsciousness?: number;
}

/**
 * Builds a dessert — separate from `buildRegionalMeal` because desserts are
 * fruit/grain/sugar-driven, not protein-driven; forcing chicken or lentils
 * through the savory pipeline for a "dessert" slot made no sense.
 */
export function buildRegionalDessert(input: RegionalDessertInput): RegionalMeal {
  const { region, fruit, grain, seed, isSafe, healthConsciousness = 3 } = input;
  const allStyles = DESSERT_BY_REGION[region] ?? GLOBAL_DESSERT;
  const lightStyles = allStyles.filter((s) => s.light);
  const styles = healthConsciousness >= 4 && lightStyles.length ? lightStyles : allStyles;
  const style = styles[seed % styles.length];

  const safeAromatics = style.aromatics.filter(isSafe);
  const loc = (s: string) => localizeName(s, region);
  const lAromatics = safeAromatics.map(loc);
  const aromaticsText = lAromatics.length ? joinList(lAromatics) : 'a little sugar';
  const spicesText = joinList(style.spices);

  const ctx: DessertCtx = {
    fruit: loc(fruit),
    grain: loc(grain),
    aromatics: aromaticsText,
    spices: spicesText,
  };

  return {
    name: style.name(loc(fruit), loc(grain)),
    cuisine: CUISINE_LABEL[region] ?? 'Everyday',
    extras: safeAromatics,
    recipe: {
      servings: 4,
      timeMinutes: 10 + (seed % 3) * 5,
      steps: style.steps(ctx),
    },
  };
}

export interface RegionalDrinkInput {
  region: Region;
  seed: number;
  isSafe: (ingredient: string) => boolean;
}

/** Builds a drink to round out a Surprise Me / guest spread — no protein or
 *  grain involved, just flavor + a sweetener, run through the same safety filter. */
export function buildRegionalDrink(input: RegionalDrinkInput): RegionalMeal {
  const { region, seed, isSafe } = input;
  const styles = DRINK_BY_REGION[region] ?? GLOBAL_DRINKS;
  const style = styles[seed % styles.length];

  const safeAromatics = style.aromatics.filter(isSafe);
  const loc = (s: string) => localizeName(s, region);
  const lAromatics = safeAromatics.map(loc);
  const aromaticsText = lAromatics.length ? joinList(lAromatics) : 'a little sugar';
  const spicesText = joinList(style.spices.length ? style.spices : ['sugar']);

  const ctx: DrinkCtx = { aromatics: aromaticsText, spices: spicesText };

  return {
    name: style.name(),
    cuisine: CUISINE_LABEL[region] ?? 'Everyday',
    extras: safeAromatics,
    recipe: {
      servings: 4,
      timeMinutes: 5 + (seed % 2) * 5,
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
/* Food visuals — clipart + gradient tile (no network, always loads)  */
/* ------------------------------------------------------------------ */

/** One of the brand's 7 recoloured food cliparts (see components/art.ts). */
export type Clipart = 'rice' | 'ramen' | 'fruits' | 'steak' | 'sandwich' | 'tacos' | 'cinnamon';

type Visual = { clipart: Clipart; colors: [string, string] };

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

// Only 7 cliparts exist — match the clearest cases by name, and hash-rotate
// the rest (curries, lentils, salads, plain proteins…) across all 7 rather
// than force a wrong-looking icon onto a dish it doesn't resemble.
const CLIPART_RULES: { re: RegExp; clipart: Clipart }[] = [
  { re: /toastie|toast|sandwich|chaat/i, clipart: 'sandwich' },
  { re: /halwa|sheera|muffin|scone|pakora|pakoray|tikki|cutlet|fritter|samosa/i, clipart: 'cinnamon' },
  { re: /biryani|pulao|pilaf|rice bowl|fried rice/i, clipart: 'rice' },
  { re: /stir-fry|noodle|claypot/i, clipart: 'ramen' },
  { re: /taco|tortilla|wrap/i, clipart: 'tacos' },
  { re: /beef|lamb|goat|steak|mutton|traybake|baked|roast/i, clipart: 'steak' },
  { re: /sabzi|salad|vegetable|veg /i, clipart: 'fruits' },
];

const CLIPART_ROTATION: Clipart[] = ['ramen', 'tacos', 'sandwich', 'steak', 'rice', 'fruits', 'cinnamon'];

/** A YouTube search link for a dish — opens real cooking videos, no API key. */
export function youtubeSearchUrl(dish: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${dish} recipe`)}`;
}

/** Deterministic clipart + gradient for a meal, from its name. */
export function mealVisual(name: string, _ingredients: string[]): Visual {
  let clipart: Clipart | undefined;
  for (const r of CLIPART_RULES) if (r.re.test(name)) { clipart = r.clipart; break; }

  // Stable hash so the same dish always gets the same tile colour (and
  // clipart, when no rule matched).
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  if (!clipart) clipart = CLIPART_ROTATION[h % CLIPART_ROTATION.length];
  return { clipart, colors: GRADIENTS[h % GRADIENTS.length] };
}
