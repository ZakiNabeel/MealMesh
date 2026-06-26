/**
 * Batch food-photo source for the desktop slideshow. When a Pexels key is
 * configured (`EXPO_PUBLIC_PEXELS_KEY`) it pulls a spread of real, appetising
 * dish photos; otherwise callers fall back to emoji-gradient tiles. The result
 * is fetched once and memoised for the session.
 */

const PEXELS_KEY = process.env.EXPO_PUBLIC_PEXELS_KEY;

/** A spread of world cuisines so the rail feels like MealMesh's many households. */
const QUERIES = [
  'biryani',
  'home cooked curry',
  'mezze platter',
  'fresh salad bowl',
  'grilled vegetables',
  'noodle bowl',
  'breakfast spread',
  'roast dinner plate',
  'tacos',
  'sushi platter',
];

/** Dish names used for the emoji-gradient fallback when there's no Pexels key. */
export const FALLBACK_DISHES: { name: string; ingredients: string[] }[] = [
  { name: 'Chicken biryani', ingredients: ['chicken', 'rice'] },
  { name: 'Garden salad', ingredients: ['lettuce', 'tomato'] },
  { name: 'Lentil daal', ingredients: ['lentils'] },
  { name: 'Grilled fish', ingredients: ['fish'] },
  { name: 'Veg stir-fry', ingredients: ['vegetables', 'noodles'] },
  { name: 'Egg breakfast', ingredients: ['eggs'] },
  { name: 'Bean tacos', ingredients: ['beans'] },
  { name: 'Roast vegetables', ingredients: ['vegetables'] },
];

let inflight: Promise<string[]> | null = null;

async function fetchOne(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=2&orientation=portrait`,
      { headers: { Authorization: PEXELS_KEY ?? '' } },
    );
    const json = (await res.json()) as { photos?: { src?: { portrait?: string; large?: string } }[] };
    return (json.photos ?? [])
      .map((p) => p.src?.portrait ?? p.src?.large)
      .filter((u): u is string => typeof u === 'string');
  } catch {
    return [];
  }
}

/** Returns a list of real food-photo URLs, or `[]` if Pexels isn't configured. */
export function loadFoodPhotos(): Promise<string[]> {
  if (!PEXELS_KEY) return Promise.resolve([]);
  if (!inflight) {
    inflight = Promise.all(QUERIES.map(fetchOne)).then((groups) => {
      const urls = groups.flat();
      // Keep it interesting even if some queries came back empty.
      return urls.length ? urls : [];
    });
  }
  return inflight;
}
