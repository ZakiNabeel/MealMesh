/**
 * A dish thumbnail. Shows a REAL food photo when a Pexels key is configured
 * (`EXPO_PUBLIC_PEXELS_KEY` — free from pexels.com/api), otherwise falls back to
 * the always-available emoji-on-gradient tile. Results are cached per query —
 * in memory for the session, and in AsyncStorage across app restarts/sessions
 * — so a given dish query hits the Pexels API at most once ever per device,
 * not once per page load.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Text, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { mealVisual } from '@/lib/cuisine';

const PEXELS_KEY = process.env.EXPO_PUBLIC_PEXELS_KEY;
const STORAGE_KEY = '@mealmesh/pexels-image-cache';

const cache = new Map<string, string | null>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function hydrate(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const stored = JSON.parse(raw) as Record<string, string | null>;
          for (const [k, v] of Object.entries(stored)) cache.set(k, v);
        }
      })
      .catch(() => {})
      .finally(() => {
        hydrated = true;
      });
  }
  return hydratePromise;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) return;
  // Debounced — batches several new entries (common on first load of a
  // multi-dish screen) into one write instead of one per resolved photo.
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache))).catch(() => {});
  }, 1000);
}

async function resolvePhoto(query: string): Promise<string | null> {
  if (!PEXELS_KEY) return null;
  if (!hydrated) await hydrate();
  if (cache.has(query)) return cache.get(query) ?? null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } },
    );
    const json = (await res.json()) as { photos?: { src?: { medium?: string; large?: string } }[] };
    const url = json.photos?.[0]?.src?.large ?? json.photos?.[0]?.src?.medium ?? null;
    cache.set(query, url);
    schedulePersist();
    return url;
  } catch {
    cache.set(query, null);
    schedulePersist();
    return null;
  }
}

export function FoodImage({
  name,
  ingredients,
  query,
  style,
  radius = Radius.sm,
  emojiSize = 26,
}: {
  name: string;
  ingredients: string[];
  /** Override the photo search query (defaults to the dish name + "food"). */
  query?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  emojiSize?: number;
}) {
  const { emoji, colors } = mealVisual(name, ingredients);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolvePhoto(query ?? `${name} food`).then((u) => {
      if (!cancelled) setUri(u);
    });
    return () => {
      cancelled = true;
    };
  }, [name, query]);

  if (uri) {
    return <Image source={{ uri }} alt={name} resizeMode="cover" style={[{ borderRadius: radius }, style] as StyleProp<ImageStyle>} />;
  }
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.2 }}>{emoji}</Text>
    </LinearGradient>
  );
}
