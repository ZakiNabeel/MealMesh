import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Heading, PressableScale, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';

const UPDATED = 'July 2026';

export default function Terms() {
  const router = useRouter();
  const palette = usePalette();

  return (
    <Screen art={Art.steak} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Terms of Service</Heading>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four, maxWidth: 680 }}>
        <Small color={palette.textSecondary}>Last updated: {UPDATED}</Small>

        <Section title="The service">
          <Body color={palette.textSecondary}>
            MealMesh generates a weekly meal plan and grocery list for a household whose members may have different
            dietary needs. By using MealMesh you agree to these terms.
          </Body>
        </Section>

        <Section title="Accounts & subscriptions">
          <Body color={palette.textSecondary}>
            Free accounts include one member profile and a limited number of AI-generated plans per week. Pro
            removes those limits. Web subscriptions are billed and managed by Freemius, our merchant of record;
            mobile subscriptions (once available) will be billed through the App Store or Play Store via RevenueCat.
            You can cancel at any time through the billing provider you subscribed with.
          </Body>
        </Section>

        <Section title="A note on health & dietary safety">
          <Body color={palette.textSecondary}>
            MealMesh enforces every constraint you mark as hard (allergens, religious restrictions) with a
            deterministic code check, not just a model's best guess — that check is the core of the product. Even so,
            MealMesh is not a medical or religious authority. For serious allergies, medical diets, or religious
            dietary law, use your own judgment and consult a qualified professional before relying on any plan.
          </Body>
        </Section>

        <Section title="Acceptable use">
          <Body color={palette.textSecondary}>
            Don't use MealMesh to attempt to extract, scrape, or resell plan content at scale, or to interfere with
            the service for other households.
          </Body>
        </Section>

        <Section title="Community content">
          <Body color={palette.textSecondary}>
            If you make your profile public, you may post text, photos, and recipes to the community. You're
            responsible for what you post. Don't post anything illegal, hateful, harassing, spammy, or that infringes
            someone else's rights — we screen and remove content that violates this, and may suspend accounts that
            repeatedly do. Community recipes are shared for inspiration only; they are not checked against your
            household's dietary restrictions the way your own generated plan is.
          </Body>
        </Section>

        <Section title="Changes">
          <Body color={palette.textSecondary}>
            We may update these terms as the product changes. Material changes will be reflected here with an
            updated date.
          </Body>
        </Section>

        <Section title="Contact">
          <Body color={palette.textSecondary}>Questions about these terms? Email hello@mealmesh.app.</Body>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 16, color: palette.text }}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
