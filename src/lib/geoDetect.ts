/**
 * Best-effort detection of the country the user is connecting from, used ONLY to
 * pick the right regional price on the paywall (see src/lib/pricing.ts) when the
 * household hasn't set a country yet. Never used for anything sensitive.
 *
 * Order of preference:
 *   1. Cloudflare's trace endpoint (`loc=XX`) — reflects the real network
 *      location, needs no API key, sends no user data (Cloudflare only sees the
 *      requesting IP, which it would anyway). This is "where the device is
 *      logged in from".
 *   2. Browser locale region (e.g. `en-PK` → PK) — offline fallback.
 *
 * The result is cached (in-memory + AsyncStorage) so we hit the network at most
 * once per device. A failure is non-fatal: pricing just falls back to global.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CACHE_KEY = 'mm_geo_country';
let memo: string | null | undefined;

/** ISO-3166 alpha-2 from the browser locale, e.g. 'en-PK' → 'PK'. */
function countryFromLocale(): string | undefined {
  try {
    const tag =
      (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || '';
    const region = new Intl.Locale(tag).region;
    return region && region.length === 2 ? region.toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

/** Parse `loc=XX` out of Cloudflare's cdn-cgi/trace text response. */
function parseTraceLoc(text: string): string | undefined {
  const m = /(?:^|\n)loc=([A-Z]{2})/.exec(text);
  return m ? m[1] : undefined;
}

/**
 * Resolve the user's country code (or undefined). Cached; safe to call often.
 * `signal`/timeout guard keeps it from ever blocking the paywall.
 */
export async function detectCountry(): Promise<string | undefined> {
  if (memo !== undefined) return memo ?? undefined;

  // Persisted cache first.
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) {
      memo = stored;
      return stored;
    }
  } catch {
    /* ignore storage errors */
  }

  let country: string | undefined;

  // Network geo (web only — native builds fall back to locale to avoid a
  // startup network dependency on the store binary).
  if (Platform.OS === 'web' && typeof fetch !== 'undefined') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) country = parseTraceLoc(await res.text());
    } catch {
      /* offline / blocked — fall through to locale */
    }
  }

  country = country ?? countryFromLocale();

  memo = country ?? null;
  if (country) {
    try {
      await AsyncStorage.setItem(CACHE_KEY, country);
    } catch {
      /* ignore */
    }
  }
  return country;
}
