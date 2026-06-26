import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { isFreemiusConfigured, openCheckout } from '@/lib/freemius';
import { usePalette } from '@/theme/use-theme';

const FEATURES = [
  'Unlimited weekly plans',
  'Unlimited member profiles',
  'All 40+ diets & allergens',
  'Regional cuisines',
  'One-tap grocery export',
];

export default function Paywall() {
  const router = useRouter();
  const palette = usePalette();
  const { user } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const price = billing === 'monthly' ? '$2.99' : '$24.99';
  const per = billing === 'monthly' ? '/month' : '/year';

  async function goPro() {
    setNote(null);
    setBusy(true);
    const { error } = await openCheckout(billing === 'yearly' ? 'annual' : 'monthly', {
      email: user?.email ?? undefined,
      onSuccess: () => router.replace('/plan'),
    });
    setBusy(false);
    if (error === 'NOT_CONFIGURED') {
      setNote('Checkout goes live once the Freemius product IDs are set — local pricing for your region is built in.');
    } else if (error) {
      setNote(error);
    }
  }

  return (
    <Screen art={Art.steak}>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
      </View>

      <View style={styles.body}>
        <Reveal>
          <Eyebrow>MealMesh Pro</Eyebrow>
          <Heading style={{ marginTop: 4 }}>Unlock the whole table</Heading>
          <Body color={palette.textSecondary} style={{ marginTop: Spacing.two }}>
            Free covers one profile and three plans a week. Pro opens it all up.
          </Body>
        </Reveal>

        <Reveal delay={120} style={{ marginTop: Spacing.four }}>
          <GlassCard style={{ gap: Spacing.three }}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={[styles.tick, { backgroundColor: palette.accentMuted }]}>
                  <Text style={{ color: palette.accent, fontSize: 12 }}>✓</Text>
                </View>
                <Body>{f}</Body>
              </View>
            ))}
          </GlassCard>
        </Reveal>

        <Reveal delay={220} style={{ marginTop: Spacing.four, gap: Spacing.three }}>
          <View style={[styles.billing, { backgroundColor: palette.backgroundElement }]}>
            {(['monthly', 'yearly'] as const).map((b) => {
              const active = billing === b;
              return (
                <PressableScale key={b} onPress={() => setBilling(b)} to={0.97} style={{ flex: 1 }}>
                  <View style={[styles.bTab, active && { backgroundColor: palette.card }]}>
                    <Text style={{ fontFamily: active ? Type.bodySemibold : Type.bodyMedium, fontSize: 14, color: active ? palette.accent : palette.textSecondary }}>
                      {b === 'monthly' ? 'Monthly' : 'Yearly · save 30%'}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <View style={styles.priceRow}>
            <Text style={{ fontFamily: Type.displayBold, fontSize: 40, color: palette.text }}>{price}</Text>
            <Body color={palette.textSecondary}>{per}</Body>
          </View>

          <Button title={busy ? 'Opening checkout…' : 'Go Pro'} onPress={goPro} disabled={busy} />
          {note && (
            <Small color={palette.textSecondary} style={{ textAlign: 'center' }}>
              {note}
            </Small>
          )}
          <Small color={palette.textSecondary} style={{ textAlign: 'center' }}>
            {isFreemiusConfigured ? 'Cancel anytime · local pricing available' : 'Cancel anytime · powered by Freemius'}
          </Small>
        </Reveal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: Spacing.two },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.five },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  tick: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  billing: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 4 },
  bTab: { height: 42, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
});
