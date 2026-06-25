/**
 * Geo helpers: resolve a country and format a USD amount into that country's
 * local currency for the grocery-budget estimate. Data lives in countries.ts.
 */

import { COUNTRIES, CURRENCY, flagEmoji, type Country } from '@/lib/countries';

export { COUNTRIES, flagEmoji, type Country };

const DEFAULT = COUNTRIES.find((c) => c.code === 'US') ?? COUNTRIES[0];

export function countryByCode(code: string | undefined): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT;
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
