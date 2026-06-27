/**
 * Build-time Pexels lookup for article hero images. Runs during `astro build`
 * (never shipped to the client), so the key only needs to live in the build
 * environment, not as a PUBLIC_ var. Falls back to `null` — and callers fall
 * back to the article's local placeholder SVG — whenever there's no key, no
 * match, or the request fails, so a missing/rate-limited key never breaks a
 * build.
 */

const PEXELS_KEY = import.meta.env.PEXELS_KEY;

export type PexelsPhoto = { url: string; alt: string };

const cache = new Map<string, Promise<PexelsPhoto | null>>();

async function fetchOne(query: string): Promise<PexelsPhoto | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY ?? '' } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      photos?: { src?: { landscape?: string; large?: string }; alt?: string }[];
    };
    const photo = json.photos?.[0];
    const url = photo?.src?.landscape ?? photo?.src?.large;
    return url ? { url, alt: photo?.alt?.trim() || query } : null;
  } catch {
    return null;
  }
}

/** Memoised per build — identical queries across articles only hit the API once. */
export function resolvePexelsImage(query: string): Promise<PexelsPhoto | null> {
  if (!PEXELS_KEY) return Promise.resolve(null);
  if (!cache.has(query)) cache.set(query, fetchOne(query));
  return cache.get(query)!;
}
