/**
 * Helpers for a household's multi-cuisine mix (e.g. 80% Pakistani-style
 * south_asian + 20% Chinese instead of being locked to one region). Used by
 * both local generators (mockPlan, surpriseSpread) and to build the payload
 * sent to the Gemini edge function, so the proportions mean the same thing
 * everywhere.
 */

import type { CuisineWeight, Region } from '@/types';

/** Resolves a valid, 100-summing mix. Falls back to the single dominant
 *  region at 100% when `cuisines` is missing, empty, or malformed — so every
 *  existing single-region household keeps working unchanged. */
export function normalizeCuisineMix(region: Region, cuisines?: CuisineWeight[]): CuisineWeight[] {
  const cleaned = (cuisines ?? []).filter((c) => c.percent > 0);
  if (cleaned.length === 0) return [{ region, percent: 100 }];
  const total = cleaned.reduce((sum, c) => sum + c.percent, 0);
  if (total <= 0) return [{ region, percent: 100 }];
  // Re-normalize so rounding drift (e.g. 33/33/33) still sums to exactly 100.
  const scaled = cleaned.map((c) => Math.round((c.percent / total) * 100));
  const drift = 100 - scaled.reduce((sum, p) => sum + p, 0);
  scaled[0] += drift; // assign any rounding remainder to the first (dominant) entry
  return cleaned.map((c, i) => ({ region: c.region, percent: scaled[i] }));
}

/** Every distinct region present in the mix — used to widen the safety
 *  ALLOW-list pantry filter so e.g. tofu/sesame oil aren't excluded just
 *  because the dominant region is south_asian. */
export function regionsInMix(mix: CuisineWeight[]): Region[] {
  return [...new Set(mix.map((c) => c.region))];
}

/**
 * Deterministically picks which cuisine the Nth meal should draw its dish
 * style from, so the household's overall proportions match the mix while
 * individual meals look naturally varied rather than block-grouped (e.g.
 * "first 80% of the week is south_asian, then a Chinese block at the end").
 */
export function pickCuisine(mix: CuisineWeight[], seed: number, index: number): Region {
  if (mix.length <= 1) return mix[0]?.region ?? 'none';
  let h = (seed * 2654435761 + index * 40503 + 0x9e3779b9) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 2246822519) >>> 0;
  const bucket = h % 100;
  let cumulative = 0;
  for (const c of mix) {
    cumulative += c.percent;
    if (bucket < cumulative) return c.region;
  }
  return mix[mix.length - 1].region;
}
