/**
 * Chosen-at-signup username (opt-in override of the auto-generated default).
 *
 * Same shape as `marketing.ts`: the email magic-link and Google OAuth flows
 * both bounce through a full-page redirect, so there's no session yet to
 * write a username to when the user picks one on the auth screen. Stash it
 * locally and flush it to `profiles.username`/`display_name` once the
 * session lands (from the AuthProvider). New rows already get a
 * database-generated username (see migration 0005), so this only overwrites
 * it when the user actively chose one.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidUsername, updateProfile } from '@/lib/social';

const PENDING_KEY = 'mm_pending_username';

/** Remember the username the user picked on the auth screen, to apply once signed in. */
export async function setPendingUsername(username: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, username.trim().toLowerCase());
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * Flush a pending username choice to the signed-in user's profile. No-op if
 * the user never chose one this session, or if it's since been taken by
 * someone else (the auto-generated default stands in that case). Safe to
 * call on every session start.
 */
export async function applyPendingUsername(): Promise<void> {
  let pending: string | null = null;
  try {
    pending = await AsyncStorage.getItem(PENDING_KEY);
  } catch {
    return;
  }
  if (pending === null) return;

  if (isValidUsername(pending)) {
    const { error } = await updateProfile({ username: pending, displayName: pending });
    if (error) return; // e.g. taken — leave the pending flag for a retry next session
  }

  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
