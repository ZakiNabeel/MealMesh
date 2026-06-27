/**
 * Batch food-photo source for the desktop slideshow. When a Pexels key is
 * configured (`EXPO_PUBLIC_PEXELS_KEY`) it pulls a spread of real, appetising
 * dish photos; otherwise callers fall back to emoji-gradient tiles. The
 * resolved URL list is cached in AsyncStorage — across app restarts, not just
 * within a session — so this fixed set of queries hits the Pexels API once
 * per device, ever, rather than once per visit.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PEXELS_KEY = process.env.EXPO_PUBLIC_PEXELS_KEY;
const STORAGE_KEY = '@mealmesh/pexels-slideshow-cache';

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
    inflight = AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((raw) => {
        if (raw) {
          const cached = JSON.parse(raw) as string[];
          if (cached.length) return cached;
        }
        return Promise.all(QUERIES.map(fetchOne)).then((groups) => {
          const urls = groups.flat();
          if (urls.length) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(urls)).catch(() => {});
          return urls;
        });
      });
  }
  return inflight;
}
