import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Art } from '@/components/art';
import { MeshMark } from '@/components/MeshMark';
import { Body, Button, Display, Eyebrow, Reveal, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';

const SAMPLE_DIETS = ['Halal', 'Gluten-free', 'Vegan', 'Nut allergy', 'Diabetic'];

export default function Welcome() {
  const router = useRouter();
  const palette = usePalette();

  return (
    <Screen art={Art.rice}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
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

          <Reveal delay={460} style={styles.tags}>
            {SAMPLE_DIETS.map((d, i) => (
              <View
                key={d}
                style={[
                  styles.tag,
                  { backgroundColor: palette.card, borderColor: i % 2 === 1 ? palette.blueMuted : palette.border },
                ]}
              >
                <View style={[styles.tagDot, { backgroundColor: i % 2 === 1 ? palette.blue : palette.accent }]} />
                <Small color={palette.text} style={{ fontFamily: Type.bodyMedium }}>
                  {d}
                </Small>
              </View>
            ))}
          </Reveal>
        </View>

        <Reveal delay={580} style={styles.actions}>
          <Button title="Build our plan" onPress={() => router.push('/onboarding')} />
          <Button
            title="I already have an account"
            variant="secondary"
            onPress={() => router.push('/auth')}
          />
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: Spacing.four, gap: Spacing.five },
  hero: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  headlineWrap: { paddingHorizontal: Spacing.two },
  headline: { textAlign: 'center' },
  subWrap: { paddingHorizontal: Spacing.three },
  sub: { textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagDot: { width: 7, height: 7, borderRadius: 7 },
  actions: { gap: Spacing.two },
});
