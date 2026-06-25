import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { MeshMark } from '@/components/MeshMark';
import { Body, Button, Eyebrow, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { usePalette } from '@/theme/use-theme';

export default function Auth() {
  const router = useRouter();
  const palette = usePalette();
  const { session, signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const { error: e } = await signInWithEmail(email);
    setBusy(null);
    if (e) setError(e);
    else setSent(true);
  }

  async function onGoogle() {
    setError(null);
    setBusy('google');
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
          <MeshMark size={84} />
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
                  <Text style={{ fontFamily: Type.bodyBold, fontSize: 15, color: '#4285F4' }}>G</Text>
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
