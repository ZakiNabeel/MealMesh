import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Heading, PressableScale, Screen, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/theme/use-theme';

const UPDATED = 'June 2026';

export default function Privacy() {
  const router = useRouter();
  const palette = usePalette();

  return (
    <Screen art={Art.fruits} wide>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <Heading>Privacy Policy</Heading>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four, maxWidth: 680 }}>
        <Small color={palette.textSecondary}>Last updated: {UPDATED}</Small>

        <Section title="What we collect">
          <Body color={palette.textSecondary}>
            Your account email (via Supabase Auth), the household and member profiles you create — names, age bands,
            and dietary constraints such as allergies, medical, religious, or lifestyle diets — and the meal plans
            and grocery lists generated for you. We also record basic usage events (sign-up, onboarding completed,
            plan generated, paywall viewed, subscribed) for product analytics. We do not send the contents of your
            dietary or health data to analytics — only that an event happened.
          </Body>
        </Section>

        <Section title="How we use it">
          <Body color={palette.textSecondary}>
            Your household's constraints are merged into a hard-exclude list, a soft-avoid list, and an allow-list,
            which are sent to Google's Gemini API to generate a plan — labeled only as "member 1", "member 2", etc.,
            never by the name you gave them. Every plan is then re-checked deterministically in our own code against
            your hard-exclude list before it is ever shown to you — this check does not rely on the model alone.
          </Body>
        </Section>

        <Section title="Who we share it with">
          <Body color={palette.textSecondary}>
            Supabase hosts our database and authentication. Google's Gemini API generates plan content from your
            structured dietary constraints only (no names, emails, or account details). Freemius processes web
            subscription payments; RevenueCat will process mobile subscriptions once mobile apps ship. Mixpanel
            receives anonymous product usage events only. We do not sell your data.
          </Body>
        </Section>

        <Section title="Your data, your control">
          <Body color={palette.textSecondary}>
            Row Level Security is enabled on every table — you can only read or write data tied to your own account.
            You can edit or remove members and household data any time from Settings. To request full account
            deletion, contact us below.
          </Body>
        </Section>

        <Section title="Contact">
          <Body color={palette.textSecondary}>Questions about this policy? Email hello@mealmesh.app.</Body>
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
