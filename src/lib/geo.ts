/**
 * Geo helpers: resolve a country and format a USD amount into that country's
 * local currency for the grocery-budget estimate. Data lives in countries.ts.
 */

import type { Region } from '@/types';
import { COUNTRIES, CURRENCY, flagEmoji, type Country } from '@/lib/countries';

export { COUNTRIES, flagEmoji, type Country };

const DEFAULT = COUNTRIES.find((c) => c.code === 'US') ?? COUNTRIES[0];

export function countryByCode(code: string | undefined): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT;
}

/**
 * Local food-price level relative to the US (US = 1.0). Our base ingredient
 * costs are US prices; converting them straight through the FX rate massively
 * overstates groceries in low-cost markets (US prices are not what a family in
 * Karachi actually pays). This index corrects for that — roughly a food-only
 * PPP factor — so the budget estimate reflects real local prices.
 */
const REGION_FOOD_INDEX: Record<Region, number> = {
  south_asian: 0.32,
  middle_eastern: 0.6,
  mediterranean: 0.8,
  east_asian: 0.6,
  latin: 0.5,
  african: 0.42,
  none: 1.0,
};

/** Country overrides where the country diverges from its region's average. */
const COUNTRY_FOOD_INDEX: Record<string, number> = {
  // Gulf: high food prices despite being in the MENA region
  AE: 0.95, SA: 0.9, QA: 1.05, KW: 0.9, BH: 0.85, OM: 0.8,
  // South Asia / lower-income
  PK: 0.3, IN: 0.32, BD: 0.3, LK: 0.4, NP: 0.32, AF: 0.3,
  // MENA non-Gulf
  EG: 0.4, MA: 0.5, TN: 0.5, DZ: 0.45, JO: 0.6, LB: 0.6,
  // Expensive Western
  CH: 1.25, NO: 1.2, DK: 1.15, IS: 1.2,
  // Lower-cost LATAM / Africa
  NG: 0.45, KE: 0.45, ET: 0.4, GH: 0.45, ZA: 0.55, MX: 0.55, CO: 0.45, AR: 0.45,
};

/** Local food-price multiplier for a country (US = 1.0). */
export function foodIndex(code: string | undefined): number {
  const c = countryByCode(code);
  return COUNTRY_FOOD_INDEX[c.code] ?? REGION_FOOD_INDEX[c.region] ?? 1.0;
}

/** Convert a USD amount to a raw local-currency NUMBER (no formatting). */
export function usdToLocalNumber(usd: number, code: string | undefined): number {
  const country = countryByCode(code);
  return usd * (CURRENCY[country.currency]?.usdRate ?? 1);
}

/**
 * How many decimals to show for a currency. Weak currencies (rate ≥ 20 per USD)
 * read better as whole numbers; the three Gulf dinars are conventionally quoted
 * to 3 places (fils); everything else to 2. This also feeds the Intl fallback.
 */
function fractionDigits(currency: string, usdRate: number): number {
  if (currency === 'BHD' || currency === 'KWD' || currency === 'OMR') return 3;
  if (usdRate >= 20) return 0;
  return 2;
}

/**
 * Format a raw LOCAL-currency amount for display. Uses `Intl.NumberFormat` with
 * the ISO currency code, which places the symbol on the correct side, groups
 * thousands, applies the right number of decimals, AND wraps the symbol in the
 * proper Unicode bidi isolates — so RTL/Arabic symbols (BHD `.د.ب`, KWD, AED…)
 * no longer reorder against Latin digits (the old `${symbol}${number}` bug).
 *
 * Hermes (native) ships without Intl currency data, so we fall back to the
 * historical symbol-prefix output if `Intl` throws. Web — the only live
 * surface — has full Intl, so this is correct everywhere it currently runs.
 */
export function formatCurrency(localAmount: number, currency: string): string {
  const rate = CURRENCY[currency] ?? CURRENCY.USD;
  const digits = fractionDigits(currency, rate.usdRate);
  const rounded = digits === 0 ? Math.round(localAmount / 10) * 10 : localAmount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(rounded);
  } catch {
    // Native fallback — keep the symbol but space it off the number.
    const formatted = rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
    return `${rate.symbol} ${formatted}`;
  }
}

/** Format a raw local-currency amount for the given country. */
export function formatMoney(localAmount: number, code: string | undefined): string {
  return formatCurrency(localAmount, countryByCode(code).currency);
}

/** Convert an amount in the country's local currency back to USD. */
export function localToUsd(local: number, code: string | undefined): number {
  const country = countryByCode(code);
  const rate = CURRENCY[country.currency]?.usdRate ?? 1;
  return rate ? local / rate : local;
}

/**
 * The currency symbol for a country (for input prefixes etc.). Derived from
 * `Intl` so it matches what `formatCurrency` renders; falls back to the table.
 */
export function currencySymbol(code: string | undefined): string {
  const country = countryByCode(code);
  try {
    const part = new Intl.NumberFormat(undefined, { style: 'currency', currency: country.currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    if (part) return part.value;
  } catch {
    // fall through to the static table
  }
  return CURRENCY[country.currency]?.symbol ?? '$';
}

/** Convert a USD amount to the country's currency and format it with the symbol. */
export function formatLocal(usd: number, code: string | undefined): string {
  return formatCurrency(usdToLocalNumber(usd, code), countryByCode(code).currency);
}
