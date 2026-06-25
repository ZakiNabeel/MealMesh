import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getDraftHousehold } from '@/lib/draft';
import { usePalette } from '@/theme/use-theme';

export default function Settings() {
  const router = useRouter();
  const palette = usePalette();
  const { user, signOut } = useAuth();
  const household = getDraftHousehold();

  return (
    <Screen art={Art.tacos}>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Settings</Heading>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        <Reveal>
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

        <Reveal delay={80}>
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

        <Reveal delay={160}>
          <Section title="Subscription">
            <Row label="Plan" value="Free" />
            <Button title="Upgrade to Pro" onPress={() => router.push('/paywall')} />
          </Section>
        </Reveal>

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
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
});
