/**
 * Freemius web checkout. Loads the Freemius Checkout SDK on demand and opens
 * the overlay for the Pro plan. All IDs are public (client-safe) and come from
 * env vars — set them after creating the product (and its three regional
 * plans — see src/lib/pricing.ts) in the Freemius dashboard:
 *
 *   EXPO_PUBLIC_FREEMIUS_PRODUCT_ID            (Product → Settings → Product ID)
 *   EXPO_PUBLIC_FREEMIUS_PLAN_ID_PK             (Pakistan-tier plan's ID)
 *   EXPO_PUBLIC_FREEMIUS_PLAN_ID_ASIA_AFRICA    (Asia/Africa-tier plan's ID)
 *   EXPO_PUBLIC_FREEMIUS_PLAN_ID_GLOBAL         (global-tier plan's ID)
 *   EXPO_PUBLIC_FREEMIUS_PUBLIC_KEY             (Product → Settings → Keys → Public Key, pk_…)
 *
 * Until those are set, `isFreemiusConfigured` is false and the paywall shows a
 * "coming soon" note instead of opening checkout. Activation of Pro after a
 * purchase happens server-side via the freemius-webhook Edge Function.
 */

import { Platform } from 'react-native';

import type { PriceTier } from '@/lib/pricing';

const PRODUCT_ID = process.env.EXPO_PUBLIC_FREEMIUS_PRODUCT_ID;
const PUBLIC_KEY = process.env.EXPO_PUBLIC_FREEMIUS_PUBLIC_KEY;

const PLAN_IDS: Record<PriceTier, string | undefined> = {
  pk: process.env.EXPO_PUBLIC_FREEMIUS_PLAN_ID_PK,
  asia_africa: process.env.EXPO_PUBLIC_FREEMIUS_PLAN_ID_ASIA_AFRICA,
  global: process.env.EXPO_PUBLIC_FREEMIUS_PLAN_ID_GLOBAL,
};

export const isFreemiusConfigured = Boolean(PRODUCT_ID && PUBLIC_KEY && PLAN_IDS.global);

const JQUERY_URL = 'https://code.jquery.com/jquery-3.7.1.min.js';
const SCRIPT_URL = 'https://checkout.freemius.com/checkout.min.js';

// Minimal shape of the global the SDK installs. FS.Checkout is a singleton
// object (not a class) exposing configure(...) -> handler, handler.open(...).
type FreemiusHandler = { open: (opts: Record<string, unknown>) => void };
type FreemiusGlobal = { Checkout: { configure: (config: Record<string, unknown>) => FreemiusHandler } };
function fsGlobal(): FreemiusGlobal | undefined {
  return (globalThis as unknown as { FS?: FreemiusGlobal }).FS;
}

function loadExternalScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('web only'));
  if (fsGlobal()?.Checkout) return Promise.resolve();
  if (!scriptPromise) {
    // checkout.min.js's own code is wrapped as `}(jQuery)` — it depends on a
    // global jQuery being present when it runs, or FS.Checkout never gets
    // assigned (only the jQuery-independent FS.Logger does).
    scriptPromise = (async () => {
      if (!(globalThis as unknown as { jQuery?: unknown }).jQuery) {
        await loadExternalScript(JQUERY_URL);
      }
      await loadExternalScript(SCRIPT_URL);
    })();
  }
  return scriptPromise;
}

/** Open the Freemius checkout overlay for the chosen billing cycle and price tier. */
export async function openCheckout(
  cycle: 'monthly' | 'annual',
  tier: PriceTier,
  opts?: { email?: string; onSuccess?: (data: unknown) => void },
): Promise<{ error?: string }> {
  if (!isFreemiusConfigured) return { error: 'NOT_CONFIGURED' };
  if (Platform.OS !== 'web') {
    return { error: 'Checkout runs on the web app for now — mobile billing arrives with the app-store release.' };
  }
  // Fall back to the global plan if a regional one hasn't been created yet —
  // better to charge the wrong (higher) tier than to fail checkout outright.
  const planId = PLAN_IDS[tier] ?? PLAN_IDS.global;
  try {
    await loadScript();
    const FS = fsGlobal();
    if (!FS) return { error: 'Could not load checkout. Please try again.' };
    const handler = FS.Checkout.configure({
      plugin_id: PRODUCT_ID,
      plan_id: planId,
      public_key: PUBLIC_KEY,
    });
    handler.open({
      name: 'MealMesh',
      billing_cycle: cycle,
      user_email: opts?.email,
      success: (data: unknown) => opts?.onSuccess?.(data),
    });
    return {};
  } catch (e) {
    console.error('[freemius] checkout failed', e);
    return { error: 'Could not open checkout. Please try again.' };
  }
}
