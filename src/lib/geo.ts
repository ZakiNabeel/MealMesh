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

/** Format a raw local-currency amount with the country's symbol. */
export function formatMoney(localAmount: number, code: string | undefined): string {
  const country = countryByCode(code);
  const rate = CURRENCY[country.currency] ?? CURRENCY.USD;
  const big = rate.usdRate >= 20;
  const rounded = big ? Math.round(localAmount / 10) * 10 : Math.round(localAmount * 100) / 100;
  return `${rate.symbol}${rounded.toLocaleString(undefined, { maximumFractionDigits: big ? 0 : 2 })}`;
}

/** Convert an amount in the country's local currency back to USD. */
export function localToUsd(local: number, code: string | undefined): number {
  const country = countryByCode(code);
  const rate = CURRENCY[country.currency]?.usdRate ?? 1;
  return rate ? local / rate : local;
}

/** The currency symbol for a country (for input prefixes etc.). */
export function currencySymbol(code: string | undefined): string {
  const country = countryByCode(code);
  return CURRENCY[country.currency]?.symbol ?? '$';
}

/** Convert a USD amount to the country's currency and format it with the symbol. */
export function formatLocal(usd: number, code: string | undefined): string {
  const country = countryByCode(code);
  const rate = CURRENCY[country.currency] ?? CURRENCY.USD;
  const value = usd * rate.usdRate;
  const big = rate.usdRate >= 20; // weak currency → no decimals, round to 10s
  const rounded = big ? Math.round(value / 10) * 10 : Math.round(value * 100) / 100;
  const formatted = rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: big ? 0 : 2,
  });
  return `${rate.symbol}${formatted}`;
}
