/**
 * Freemius web checkout. Loads the Freemius Checkout SDK on demand and opens
 * the overlay for the Pro plan. All IDs are public (client-safe) and come from
 * env vars — set them after creating the product in the Freemius dashboard:
 *
 *   EXPO_PUBLIC_FREEMIUS_PRODUCT_ID   (Product → Settings → Product ID)
 *   EXPO_PUBLIC_FREEMIUS_PLAN_ID      (the Pro plan's ID)
 *   EXPO_PUBLIC_FREEMIUS_PUBLIC_KEY   (Product → Settings → Keys → Public Key, pk_…)
 *
 * Until those are set, `isFreemiusConfigured` is false and the paywall shows a
 * "coming soon" note instead of opening checkout. Activation of Pro after a
 * purchase happens server-side via the freemius-webhook Edge Function.
 */

import { Platform } from 'react-native';

const PRODUCT_ID = process.env.EXPO_PUBLIC_FREEMIUS_PRODUCT_ID;
const PLAN_ID = process.env.EXPO_PUBLIC_FREEMIUS_PLAN_ID;
const PUBLIC_KEY = process.env.EXPO_PUBLIC_FREEMIUS_PUBLIC_KEY;

export const isFreemiusConfigured = Boolean(PRODUCT_ID && PUBLIC_KEY);

const SCRIPT_URL = 'https://checkout.freemius.com/checkout.min.js';

// Minimal shape of the global the SDK installs.
type FreemiusCheckout = { open: (opts: Record<string, unknown>) => void };
type FreemiusGlobal = { Checkout: new (config: Record<string, unknown>) => FreemiusCheckout };
function fsGlobal(): FreemiusGlobal | undefined {
  return (globalThis as unknown as { FS?: FreemiusGlobal }).FS;
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('web only'));
  if (fsGlobal()?.Checkout) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = SCRIPT_URL;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Failed to load Freemius checkout'));
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

/** Open the Freemius checkout overlay for the chosen billing cycle. */
export async function openCheckout(
  cycle: 'monthly' | 'annual',
  opts?: { email?: string; onSuccess?: (data: unknown) => void },
): Promise<{ error?: string }> {
  if (!isFreemiusConfigured) return { error: 'NOT_CONFIGURED' };
  if (Platform.OS !== 'web') {
    return { error: 'Checkout runs on the web app for now — mobile billing arrives with the app-store release.' };
  }
  try {
    await loadScript();
    const FS = fsGlobal();
    if (!FS) return { error: 'Could not load checkout. Please try again.' };
    const checkout = new FS.Checkout({
      product_id: PRODUCT_ID,
      plan_id: PLAN_ID,
      public_key: PUBLIC_KEY,
    });
    checkout.open({
      name: 'MealMesh',
      billing_cycle: cycle,
      user_email: opts?.email,
      success: (data: unknown) => opts?.onSuccess?.(data),
    });
    return {};
  } catch {
    return { error: 'Could not open checkout. Please try again.' };
  }
}
