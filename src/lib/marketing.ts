/**
 * Marketing email consent (opt-in).
 *
 * The consent choice is made on the auth screen BEFORE sign-in — but the email
 * magic-link and Google OAuth flows both bounce through a full-page redirect, so
 * we can't write it to the DB right then (there's no session yet). Instead we
 * stash the choice locally and flush it to `profiles.marketing_opt_in` once the
 * session lands (from the AuthProvider). Consent is explicit opt-in: nothing is
 * recorded unless the user actively chose.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const PENDING_KEY = 'mm_marketing_consent_pending';

/** Remember the user's consent choice to apply once they're signed in. */
export async function setPendingMarketingConsent(optIn: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, optIn ? '1' : '0');
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * Flush a pending consent choice to the signed-in user's profile. No-op if the
 * user never made a choice this session. Safe to call on every session start.
 */
export async function applyPendingMarketingConsent(userId: string): Promise<void> {
  let pending: string | null = null;
  try {
    pending = await AsyncStorage.getItem(PENDING_KEY);
  } catch {
    return;
  }
  if (pending === null) return;

  const optIn = pending === '1';
  const { error } = await supabase
    .from('profiles')
    .update({
      marketing_opt_in: optIn,
      marketing_opt_in_at: optIn ? new Date().toISOString() : null,
    })
    .eq('user_id', userId);

  // Clear only on success, so a transient failure retries next session.
  if (!error) {
    try {
      await AsyncStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  }
}
