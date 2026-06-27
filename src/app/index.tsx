import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Art } from '@/components/art';
import { MeshMark } from '@/components/MeshMark';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Body, Button, Display, Eyebrow, PressableScale, Reveal, Screen, Small, useIsInstalledApp } from '@/components/ui';
import { WebsiteLanding } from '@/components/WebsiteLanding';
import { Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { usePalette } from '@/theme/use-theme';

export default function Welcome() {
  // Browser visitors (phone or laptop) see the marketing website; the installed
  // PWA and the native app get the focused app experience.
  const isApp = useIsInstalledApp();
  const router = useRouter();
  const { session, loading } = useAuth();

  // A signed-in visitor landing on "/" (e.g. right after Google OAuth, or just
  // revisiting the bare domain) should land on the Home dashboard, not the
  // marketing site / welcome screen with no sign anything happened.
  useEffect(() => {
    if (!loading && session) router.replace('/home');
  }, [loading, session, router]);

  if (!isApp) return session ? null : <WebsiteLanding />;
  return <MobileWelcome />;
}

function MobileWelcome() {
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();

  return (
    <Screen art={Art.rice}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Reveal style={{ alignItems: 'center' }}>
            <MeshMark size={116} />
          </Reveal>

          <Reveal delay={120}>
            <Eyebrow style={{ textAlign: 'center' }}>MealMesh</Eyebrow>
          </Reveal>

          <Reveal delay={220} style={styles.headlineWrap}>
            <Display style={styles.headline}>One household.{'\n'}Many diets. One plan.</Display>
          </Reveal>

          <Reveal delay={340} style={styles.subWrap}>
            <Body color={palette.textSecondary} style={styles.sub}>
              One weekly meal plan that works for everyone at the table — and a single grocery list to match.
            </Body>
          </Reveal>
        </View>

        <Reveal delay={460} style={styles.actions}>
          {session ? (
            <>
              <Button title="Go to my home" onPress={() => router.push('/home')} />
              <Button title="Set up a new household" variant="secondary" onPress={() => router.push('/onboarding')} />
            </>
          ) : (
            <>
              <Button title="Build our plan" onPress={() => router.push('/onboarding')} />
              <Button title="I already have an account" variant="secondary" onPress={() => router.push('/auth')} />
            </>
          )}
          <PressableScale onPress={() => router.push('/pantry')} to={0.97}>
            <Body color={palette.accent} style={{ textAlign: 'center', fontFamily: Type.bodySemibold, paddingVertical: Spacing.two }}>
              🥘  Cook with what I have
            </Body>
          </PressableScale>
          <View style={{ alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.two }}>
            <Small color={palette.textSecondary}>Theme</Small>
            <ThemeSwitcher />
          </View>
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: Spacing.four, gap: Spacing.five },
  hero: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingTop: Spacing.six },
  headlineWrap: { paddingHorizontal: Spacing.two },
  headline: { textAlign: 'center' },
  subWrap: { paddingHorizontal: Spacing.three },
  sub: { textAlign: 'center' },
  actions: { gap: Spacing.two },
});
