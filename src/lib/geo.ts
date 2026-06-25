/**
 * Country → currency mapping for region-based pricing and grocery-budget
 * estimates. Rates are APPROXIMATE (updated occasionally, labelled "approx" in
 * the UI) — they only power a rough weekly budget figure, never a payment, so
 * they don't need to be live. The currency a household sees is derived from the
 * country they pick in onboarding.
 */

import type { Region } from '@/types';

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  label: string;
  flag: string;
  currency: string; // ISO 4217
  symbol: string;
  /** Approx units of this currency per 1 USD. */
  usdRate: number;
  /** Suggested cuisine region when this country is picked. */
  region: Region;
}

/**
 * A curated list (not all 195 countries — that's a future searchable picker).
 * Covers the launch markets: South Asia, the Gulf/MENA, and the diaspora hubs.
 */
export const COUNTRIES: Country[] = [
  { code: 'PK', label: 'Pakistan', flag: '🇵🇰', currency: 'PKR', symbol: '₨', usdRate: 278, region: 'south_asian' },
  { code: 'IN', label: 'India', flag: '🇮🇳', currency: 'INR', symbol: '₹', usdRate: 83, region: 'south_asian' },
  { code: 'BD', label: 'Bangladesh', flag: '🇧🇩', currency: 'BDT', symbol: '৳', usdRate: 118, region: 'south_asian' },
  { code: 'AE', label: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', symbol: 'د.إ', usdRate: 3.67, region: 'middle_eastern' },
  { code: 'SA', label: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR', symbol: '﷼', usdRate: 3.75, region: 'middle_eastern' },
  { code: 'QA', label: 'Qatar', flag: '🇶🇦', currency: 'QAR', symbol: 'ر.ق', usdRate: 3.64, region: 'middle_eastern' },
  { code: 'EG', label: 'Egypt', flag: '🇪🇬', currency: 'EGP', symbol: 'E£', usdRate: 48, region: 'middle_eastern' },
  { code: 'US', label: 'United States', flag: '🇺🇸', currency: 'USD', symbol: '$', usdRate: 1, region: 'none' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', symbol: '£', usdRate: 0.79, region: 'none' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦', currency: 'CAD', symbol: 'C$', usdRate: 1.37, region: 'none' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺', currency: 'AUD', symbol: 'A$', usdRate: 1.52, region: 'none' },
  { code: 'NG', label: 'Nigeria', flag: '🇳🇬', currency: 'NGN', symbol: '₦', usdRate: 1550, region: 'african' },
  { code: 'ZA', label: 'South Africa', flag: '🇿🇦', currency: 'ZAR', symbol: 'R', usdRate: 18, region: 'african' },
  { code: 'MY', label: 'Malaysia', flag: '🇲🇾', currency: 'MYR', symbol: 'RM', usdRate: 4.4, region: 'east_asian' },
];

const DEFAULT: Country = COUNTRIES[7]; // United States / USD

export function countryByCode(code: string | undefined): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT;
}

/** Convert a USD amount to the country's currency and format it with the symbol. */
export function formatLocal(usd: number, code: string | undefined): string {
  const c = countryByCode(code);
  const value = usd * c.usdRate;
  // Whole numbers for weak currencies, 2dp for strong ones.
  const rounded = c.usdRate >= 20 ? Math.round(value / 10) * 10 : Math.round(value * 100) / 100;
  const formatted = rounded.toLocaleString(undefined, {
    minimumFractionDigits: c.usdRate >= 20 ? 0 : 0,
    maximumFractionDigits: c.usdRate >= 20 ? 0 : 2,
  });
  return `${c.symbol}${formatted}`;
}
