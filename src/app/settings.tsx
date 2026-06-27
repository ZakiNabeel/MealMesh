import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, THEME_META, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getDraftHousehold } from '@/lib/draft';
import { useSubscription } from '@/lib/subscription';
import { usePalette, useTheme } from '@/theme/use-theme';

export default function Settings() {
  const router = useRouter();
  const palette = usePalette();
  const { themeName, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { isPro } = useSubscription();
  const household = getDraftHousehold();
  const isDesktop = useIsDesktop();
  const col = isDesktop ? styles.col : undefined;

  return (
    <Screen art={Art.tacos} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Settings</Heading>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        <View style={isDesktop ? styles.grid : { gap: Spacing.four }}>
        <Reveal style={col}>
          <Section title="Account">
            {user ? (
              <View style={{ gap: Spacing.three }}>
                <Row label="Signed in as" value={user.email ?? 'your account'} />
                <Button title="Sign out" variant="secondary" onPress={() => signOut()} />
              </View>
            ) : (
              <View style={{ gap: Spacing.two }}>
                <Body color={palette.textSecondary}>Sign in to save your plans and sync devices.</Body>
                <Button title="Sign in" onPress={() => router.push('/auth')} />
              </View>
            )}
          </Section>
        </Reveal>

        {user && (
          <Reveal delay={40} style={col}>
            <Section title="Profile & community">
              <Body color={palette.textSecondary}>
                Your public cooking profile, badges and streak — separate from your private household.
              </Body>
              <Button title="View my profile" variant="secondary" onPress={() => router.push('/profile')} />
              <Button title="Leaderboard" variant="secondary" onPress={() => router.push('/leaderboard')} />
            </Section>
          </Reveal>
        )}

        <Reveal delay={80} style={col}>
          <Section title="Household">
            <Row label="Name" value={household?.name ?? 'Not set up yet'} />
            <Row label="Members" value={household ? String(household.members.length) : '0'} />
            <Button
              title={household ? 'Edit household' : 'Set up household'}
              variant="secondary"
              onPress={() => router.push('/onboarding')}
            />
          </Section>
        </Reveal>

        <Reveal delay={160} style={col}>
          <Section title="Appearance">
            <View style={{ gap: Spacing.two }}>
              {THEME_META.map((t) => {
                const active = themeName === t.name;
                return (
                  <PressableScale key={t.name} onPress={() => setTheme(t.name)} to={0.98}>
                    <View
                      style={[
                        styles.themeRow,
                        { borderColor: active ? palette.accent : palette.border, backgroundColor: active ? palette.accentMuted : 'transparent' },
                      ]}
                    >
                      <View style={styles.swatch}>
                        {t.swatch.map((c, i) => (
                          <View key={i} style={[styles.chip, { backgroundColor: c, borderColor: palette.border }]} />
                        ))}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontFamily: Type.bodySemibold }}>{t.label}</Body>
                        <Small>{t.hint}</Small>
                      </View>
                      {active && <Text style={{ color: palette.accent, fontSize: 16 }}>✓</Text>}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </Section>
        </Reveal>

        <Reveal delay={240} style={col}>
          <Section title="Subscription">
            <Row label="Plan" value={isPro ? 'Pro ✦' : 'Free'} />
            {!isPro && <Button title="Upgrade to Pro" onPress={() => router.push('/paywall')} />}
          </Section>
        </Reveal>
        </View>

        <Small color={palette.textSecondary} style={{ textAlign: 'center' }}>
          MealMesh v0.1.0
        </Small>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <Eyebrow>{title}</Eyebrow>
      <GlassCard style={{ gap: Spacing.three }}>{children}</GlassCard>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Small>{label}</Small>
      <Body numberOfLines={1} style={{ fontFamily: Type.bodySemibold, maxWidth: '60%' }}>
        {value}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: Spacing.four },
  col: { flexGrow: 1, flexBasis: '45%', minWidth: 300 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 1.5, borderRadius: Radius.md },
  swatch: { flexDirection: 'row' },
  chip: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, marginLeft: -6 },
});
