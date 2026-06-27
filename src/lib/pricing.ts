/**
 * Regional Pro pricing tiers.
 *
 * Pakistan gets its own tier; the rest of South Asia, the Middle East/North
 * Africa, East Asia, and Sub-Saharan Africa share a second tier; everywhere
 * else pays the global rate. Derived from each country's existing cuisine
 * `region` tag (src/lib/countries.ts) rather than a separate continent list —
 * that tag already groups countries the same way geographically.
 */

import { countryByCode } from '@/lib/geo';

export type PriceTier = 'pk' | 'asia_africa' | 'global';

export const TIER_PRICES: Record<PriceTier, { monthly: string; yearly: string }> = {
  pk: { monthly: '$2.99', yearly: '$24.99' },
  asia_africa: { monthly: '$5.99', yearly: '$48.99' },
  global: { monthly: '$9.99', yearly: '$99.99' },
};

const ASIA_AFRICA_REGIONS = new Set(['south_asian', 'middle_eastern', 'east_asian', 'african']);

export function tierForCountry(code: string | undefined): PriceTier {
  if (!code) return 'global';
  if (code === 'PK') return 'pk';
  const region = countryByCode(code).region;
  return ASIA_AFRICA_REGIONS.has(region) ? 'asia_africa' : 'global';
}
