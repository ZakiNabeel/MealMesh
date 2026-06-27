/**
 * Build-time Pexels lookup for article hero images. Runs during `astro build`
 * (never shipped to the client), so the key only needs to live in the build
 * environment, not as a PUBLIC_ var. Falls back to `null` — and callers fall
 * back to the article's local placeholder SVG — whenever there's no key, no
 * match, or the request fails, so a missing/rate-limited key never breaks a
 * build.
 *
 * PERSISTENT CACHE: resolved photos are also written to the committed
 * src/data/pexels-cache.json, keyed by query. Every build reads that file
 * first — a query already in it costs zero API calls, even on a fresh Vercel
 * checkout that's never run before. Only genuinely new `imageQuery` values
 * (a new article, or an edited query) hit Pexels at all. Run `npm run build`
 * locally once after adding articles with a real PEXELS_KEY set, then commit
 * the updated cache file — Vercel's build can't write back to git itself.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const PEXELS_KEY = import.meta.env.PEXELS_KEY;

export type PexelsPhoto = { url: string; alt: string };

const CACHE_PATH = new URL('../data/pexels-cache.json', import.meta.url);

function loadFileCache(): Record<string, PexelsPhoto> {
  try {
    if (!existsSync(CACHE_PATH)) return {};
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as Record<string, PexelsPhoto>;
  } catch {
    return {};
  }
}

const fileCache = loadFileCache();
let dirty = false;

function persist(): void {
  if (!dirty) return;
  try {
    writeFileSync(CACHE_PATH, `${JSON.stringify(fileCache, null, 2)}\n`);
    dirty = false;
  } catch {
    // Best-effort — e.g. a read-only filesystem on some deploy targets.
    // The in-memory lookup for this build still works either way.
  }
}

const inflight = new Map<string, Promise<PexelsPhoto | null>>();

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

/** Checks the committed file cache first, then memoises any live fetch per build. */
export function resolvePexelsImage(query: string): Promise<PexelsPhoto | null> {
  if (fileCache[query]) return Promise.resolve(fileCache[query]);
  if (!PEXELS_KEY) return Promise.resolve(null);
  if (!inflight.has(query)) {
    inflight.set(
      query,
      fetchOne(query).then((photo) => {
        if (photo) {
          fileCache[query] = photo;
          dirty = true;
          persist();
        }
        return photo;
      }),
    );
  }
  return inflight.get(query)!;
}
