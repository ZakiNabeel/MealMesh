/**
 * Subscription tier + the free-tier plan-generation gate.
 *
 * `useSubscription` reads `subscription_status` for the signed-in user (written
 * server-side by the Freemius webhook). The gate counts how many plans a user
 * generated this week and, for free users, sends them to the paywall past the
 * limit — matching the pricing in docs (Free = 3 AI plans/week).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { currentWeekStart } from '@/lib/store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type Tier = 'free' | 'pro';

export const FREE_WEEKLY_PLANS = 3;

/** The signed-in user's tier (defaults to free / when signed out). */
export function useSubscription(): { tier: Tier; isPro: boolean; loading: boolean } {
  const { session } = useAuth();
  const [tier, setTier] = useState<Tier>('free');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      setTier('free');
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('subscription_status')
      .select('tier')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setTier((data as { tier?: string } | null)?.tier === 'pro' ? 'pro' : 'free');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { tier, isPro: tier === 'pro', loading };
}

/* ------------------------------------------------------------------ */
/* Weekly generation counter (local — gates the free tier)            */
/* ------------------------------------------------------------------ */

const GEN_KEY = 'mealmesh.generations';

export async function generationsThisWeek(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(GEN_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { week: string; count: number };
    return parsed.week === currentWeekStart() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export async function bumpGenerations(): Promise<number> {
  const count = (await generationsThisWeek()) + 1;
  await AsyncStorage.setItem(GEN_KEY, JSON.stringify({ week: currentWeekStart(), count })).catch(() => {});
  return count;
}

/* ------------------------------------------------------------------ */
/* Surprise / guest-menu counter (free = 1 per week, Pro = unlimited)  */
/* ------------------------------------------------------------------ */

const SURPRISE_KEY = 'mealmesh.surprise';

export const FREE_WEEKLY_SURPRISES = 1;

export async function surprisesThisWeek(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SURPRISE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { week: string; count: number };
    return parsed.week === currentWeekStart() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export async function bumpSurprises(): Promise<number> {
  const count = (await surprisesThisWeek()) + 1;
  await AsyncStorage.setItem(SURPRISE_KEY, JSON.stringify({ week: currentWeekStart(), count })).catch(() => {});
  return count;
}
