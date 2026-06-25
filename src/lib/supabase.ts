/**
 * Supabase client (client-side, anon/publishable key only).
 *
 * The anon/publishable key is safe to ship — Row Level Security protects data.
 * The Anthropic key and the service-role key are NEVER here.
 *
 * Hardened so a missing or malformed URL can never crash the app (important
 * because `web.output: "static"` constructs this during server prerender). If
 * the URL isn't a real `https://<ref>.supabase.co`, we fall back to a harmless
 * placeholder and expose `isSupabaseConfigured = false` so the UI can degrade
 * gracefully instead of throwing.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Accept a bare host (prepend https://) and reject non-URL values (e.g. keys). */
function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withScheme);
    // A real Supabase URL has a dotted host; a pasted key (sb_publishable_…) does not.
    return u.host.includes('.') ? u.origin : null;
  } catch {
    return null;
  }
}

const supabaseUrl = normalizeUrl(rawUrl);

/** True only when a real URL + key are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && typeof __DEV__ !== 'undefined' && __DEV__) {
  console.warn(
    '[supabase] Not configured. EXPO_PUBLIC_SUPABASE_URL must be your Project URL ' +
      '(https://<ref>.supabase.co) and EXPO_PUBLIC_SUPABASE_ANON_KEY your anon/publishable key. ' +
      'Auth and data calls are disabled until both are set in .env.',
  );
}

export const supabase = createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
