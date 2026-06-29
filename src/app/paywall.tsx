import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getDraftHousehold } from '@/lib/draft';
import { isFreemiusConfigured, openCheckout } from '@/lib/freemius';
import { TIER_PRICES, tierForCountry, type PriceTier } from '@/lib/pricing';
import { loadHousehold } from '@/lib/store';
import { usePalette } from '@/theme/use-theme';

type ComparisonRow = { label: string; free: string | boolean; pro: string | boolean };

const COMPARISON: ComparisonRow[] = [
  { label: 'Weekly AI meal plans', free: '3 / week', pro: 'Unlimited' },
  { label: 'Member profiles', free: 'Unlimited', pro: 'Unlimited' },
  { label: 'All 40+ diets & allergens', free: true, pro: true },
  { label: 'Regional cuisines', free: true, pro: true },
  { label: 'Grocery list', free: true, pro: true },
  { label: 'Grocery PDF export & share', free: false, pro: true },
  { label: 'Surprise Me (guest spreads & quick ideas)', free: false, pro: true },
  { label: 'Create a Crew (friends/family board)', free: false, pro: true },
  { label: 'Pro badge ✦', free: false, pro: true },
];

export default function Paywall() {
  const router = useRouter();
  const palette = usePalette();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  // Monthly is the promoted default; yearly is still available but not pushed.
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [tier, setTier] = useState<PriceTier>(() => tierForCountry(getDraftHousehold()?.country));
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getDraftHousehold()?.country) return; // already resolved synchronously above
    loadHousehold().then((h) => {
      if (h?.country) setTier(tierForCountry(h.country));
    });
  }, []);

  const prices = TIER_PRICES[tier];
  const price = billing === 'monthly' ? prices.monthly : prices.yearly;
  const per = billing === 'monthly' ? '/month' : '/year';

  async function goPro() {
    setNote(null);
    setBusy(true);
    const { error } = await openCheckout(billing === 'yearly' ? 'annual' : 'monthly', tier, {
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
    <Screen art={Art.steak} rail header={<AppHeader />}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Reveal>
          <Eyebrow>MealMesh Pro</Eyebrow>
          <Heading style={{ marginTop: 4 }}>Unlock the whole table</Heading>
          <Body color={palette.textSecondary} style={{ marginTop: Spacing.two }}>
            Free covers one profile and three plans a week. Pro opens it all up.
          </Body>
        </Reveal>

        <Reveal delay={120} style={{ marginTop: Spacing.four }}>
          <GlassCard style={{ gap: 0, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one }}>
            <View style={styles.compareHeader}>
              <View style={{ flex: 1 }} />
              <Text style={[styles.compareColHead, { color: palette.textSecondary }]}>Free</Text>
              <Text style={[styles.compareColHead, { color: palette.accent }]}>Pro</Text>
            </View>
            {COMPARISON.map((row, i) => (
              <View key={row.label} style={[styles.compareRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.border }]}>
                <Small style={{ flex: 1 }}>{row.label}</Small>
                <View style={styles.compareCol}>
                  <ComparisonCell value={row.free} />
                </View>
                <View style={styles.compareCol}>
                  <ComparisonCell value={row.pro} />
                </View>
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
                      {b === 'monthly' ? 'Monthly · recommended' : 'Yearly'}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <View style={[styles.priceRow, !isDesktop && { flexDirection: 'column', gap: Spacing.one }]}>
            <Text style={{ fontFamily: Type.displayBold, fontSize: isDesktop ? 40 : 32, color: palette.text }}>{price}</Text>
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
      </ScrollView>
    </Screen>
  );
}

function ComparisonCell({ value }: { value: string | boolean }) {
  const palette = usePalette();
  if (typeof value === 'boolean') {
    return value ? (
      <View style={[styles.tick, { backgroundColor: palette.accentMuted }]}>
        <Text style={{ color: palette.accent, fontSize: 12 }}>✓</Text>
      </View>
    ) : (
      <Small color={palette.textSecondary}>—</Small>
    );
  }
  return (
    <Small style={{ fontFamily: Type.bodySemibold, textAlign: 'center' }} numberOfLines={2}>
      {value}
    </Small>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, justifyContent: 'center', paddingTop: Spacing.three, paddingBottom: Spacing.five },
  tick: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  compareHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  compareColHead: { width: 64, textAlign: 'center', fontFamily: Type.bodySemibold, fontSize: 12 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  compareCol: { width: 64, alignItems: 'center' },
  billing: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 4 },
  bTab: { height: 42, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
});
