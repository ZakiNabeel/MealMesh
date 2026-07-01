import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Eyebrow, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { setPendingMarketingConsent } from '@/lib/marketing';
import { usePalette } from '@/theme/use-theme';

const LOGO = require('../../assets/logo.svg');

function dataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Google's official 4-colour "G" mark — required as-is by Google's sign-in
// button branding guidelines, not a stylistic choice.
const GOOGLE_G_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path fill='#4285F4' d='M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z'/><path fill='#34A853' d='M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C8.06 41.16 15.45 46 24 46z'/><path fill='#FBBC05' d='M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88z'/><path fill='#EA4335' d='M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.45 2 8.06 6.84 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z'/></svg>`;

export default function Auth() {
  const router = useRouter();
  const palette = usePalette();
  const { session, signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Explicit, opt-in marketing consent (default OFF). Persisted before the
  // sign-in redirect and written to the profile once the session lands.
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    if (session) router.replace('/plan');
  }, [session, router]);

  async function onMagicLink() {
    setError(null);
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy('email');
    await setPendingMarketingConsent(marketingOptIn);
    const { error: e } = await signInWithEmail(email);
    setBusy(null);
    if (e) setError(e);
    else setSent(true);
  }

  async function onGoogle() {
    setError(null);
    setBusy('google');
    await setPendingMarketingConsent(marketingOptIn);
    const { error: e } = await signInWithGoogle();
    setBusy(null);
    if (e) setError(e);
  }

  return (
    <Screen art={Art.cinnamon}>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
      </View>

      <View style={styles.body}>
        <Reveal style={{ alignItems: 'center', marginBottom: Spacing.three }}>
          <Image source={LOGO} alt="" style={{ width: 84, height: 84, borderRadius: 84 * 0.28 }} />
        </Reveal>

        <Reveal delay={100}>
          <Eyebrow>Your account</Eyebrow>
          <Heading style={{ marginTop: 4 }}>{sent ? 'Check your inbox' : 'Sign in to MealMesh'}</Heading>
        </Reveal>

        {sent ? (
          <Reveal delay={160} style={{ gap: Spacing.three, marginTop: Spacing.three }}>
            <Body color={palette.textSecondary}>
              We sent a magic link to <Body style={{ fontFamily: Type.bodySemibold }}>{email}</Body>. Tap it to
              finish signing in.
            </Body>
            <Button title="Use a different email" variant="secondary" onPress={() => setSent(false)} />
          </Reveal>
        ) : (
          <Reveal delay={160} style={{ gap: Spacing.three, marginTop: Spacing.three }}>
            <Body color={palette.textSecondary}>One tap by email, or continue with Google.</Body>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={onMagicLink}
              style={[styles.field, { color: palette.text, backgroundColor: palette.card, borderColor: palette.border }]}
            />

            <PressableScale onPress={() => setMarketingOptIn((v) => !v)} to={0.98}>
              <View style={styles.consent}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: marketingOptIn ? palette.accent : palette.border, backgroundColor: marketingOptIn ? palette.accent : 'transparent' },
                  ]}
                >
                  {marketingOptIn && <Text style={{ color: palette.card, fontSize: 13, fontFamily: Type.bodyBold }}>✓</Text>}
                </View>
                <Small color={palette.textSecondary} style={{ flex: 1 }}>
                  Email me meal-planning tips and occasional offers. Optional — you can unsubscribe anytime.
                </Small>
              </View>
            </PressableScale>

            <Button
              title={busy === 'email' ? 'Sending…' : 'Send magic link'}
              onPress={onMagicLink}
              disabled={busy !== null}
            />

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: palette.border }]} />
              <Small>or</Small>
              <View style={[styles.line, { backgroundColor: palette.border }]} />
            </View>

            <PressableScale onPress={onGoogle} disabled={busy !== null}>
              <View style={[styles.google, { borderColor: palette.border, backgroundColor: palette.card }]}>
                <View style={styles.gBadge}>
                  <Image source={{ uri: dataUri(GOOGLE_G_SVG) }} alt="" style={{ width: 18, height: 18 }} />
                </View>
                <Text style={{ fontFamily: Type.bodySemibold, fontSize: 16, color: palette.text }}>
                  {busy === 'google' ? 'Connecting…' : 'Continue with Google'}
                </Text>
              </View>
            </PressableScale>
          </Reveal>
        )}

        {error && (
          <Small color={palette.danger} style={{ marginTop: Spacing.three }}>
            {error}
          </Small>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: Spacing.two },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.six },
  field: {
    fontFamily: Type.body,
    fontSize: 16,
    height: 52,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: Spacing.one },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  line: { flex: 1, height: 1 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  gBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
