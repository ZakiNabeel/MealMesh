/**
 * Auth context — Supabase email magic link + Google OAuth.
 *
 * Web uses Supabase's redirect flow (the session is parsed from the return URL
 * by `detectSessionInUrl`). Native opens the provider in an in-app browser and
 * sets the session from the returned deep link. The Gemini/plan work doesn't
 * depend on this — it's the account layer for saving households and gating Pro.
 */

import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const NOT_CONFIGURED = 'Connect Supabase first — set your Project URL in .env (EXPO_PUBLIC_SUPABASE_URL).';

type Result = { error?: string };

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<Result>;
  signInWithGoogle: () => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function redirectUrl(path = ''): string | undefined {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? `${window.location.origin}${path}` : undefined;
  }
  return Linking.createURL('auth-callback');
}

function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const tail = url.split(/[?#]/).slice(1).join('&');
  for (const part of tail.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signInWithEmail(email) {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: redirectUrl() },
        });
        return { error: error?.message };
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
        // Web does a full-page redirect through Google and back, landing
        // wherever redirectTo points — straight to the Home dashboard, not the
        // marketing site's "/" (which would otherwise strand a signed-in user).
        const redirectTo = redirectUrl('/home');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
        });
        if (error) return { error: error.message };
        if (Platform.OS !== 'web' && data?.url && redirectTo) {
          const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (res.type === 'success' && res.url) {
            const p = parseParams(res.url);
            if (p.access_token && p.refresh_token) {
              await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
            } else if (p.code) {
              await supabase.auth.exchangeCodeForSession(p.code);
            }
          } else if (res.type === 'cancel' || res.type === 'dismiss') {
            return { error: 'Sign-in cancelled.' };
          }
        }
        return {};
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
