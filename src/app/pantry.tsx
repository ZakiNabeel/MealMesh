import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { localizeName, mealVisual } from '@/lib/cuisine';
import { cookFrom, type Suggestion } from '@/lib/cookFrom';
import { getDraftHousehold } from '@/lib/draft';
import { usePalette } from '@/theme/use-theme';
import type { Region } from '@/types';

const QUICK = ['eggs', 'rice', 'chicken', 'lentils', 'potato', 'onion', 'tomato', 'spinach', 'yogurt', 'chickpeas'];

export default function Pantry() {
  const router = useRouter();
  const palette = usePalette();
  const household = getDraftHousehold();
  const region: Region = household?.region ?? 'none';

  const [items, setItems] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof cookFrom> | null>(null);

  function add(raw: string) {
    const v = raw.trim().toLowerCase();
    if (!v) return;
    setItems((prev) => (prev.some((p) => p.toLowerCase() === v) ? prev : [...prev, v]));
    setText('');
    setResult(null);
  }
  function remove(name: string) {
    setItems((prev) => prev.filter((p) => p !== name));
    setResult(null);
  }

  return (
    <Screen art={Art.fruits}>
      <View style={styles.top}>
        <PressableScale onPress={() => router.back()} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.three, gap: Spacing.four }}>
        <Reveal>
          <Eyebrow>Cook from what you have</Eyebrow>
          <Heading style={{ marginTop: 4 }}>What&apos;s in your kitchen?</Heading>
          <Body color={palette.textSecondary} style={{ marginTop: Spacing.two }}>
            Add the ingredients you&apos;ve got and we&apos;ll suggest dishes — safe for your household.
          </Body>
        </Reveal>

        <Reveal delay={80} style={{ gap: Spacing.two }}>
          <View style={[styles.inputRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => add(text)}
              placeholder="Add an ingredient…"
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
              returnKeyType="done"
              style={{ flex: 1, fontFamily: Type.body, fontSize: 16, color: palette.text }}
            />
            <PressableScale onPress={() => add(text)} to={0.9}>
              <View style={[styles.addBtn, { backgroundColor: palette.accent }]}>
                <Text style={{ color: palette.onAccent, fontSize: 20, fontFamily: Type.bodySemibold }}>+</Text>
              </View>
            </PressableScale>
          </View>

          {/* quick-add */}
          <View style={styles.wrap}>
            {QUICK.filter((q) => !items.includes(q)).map((q) => (
              <PressableScale key={q} onPress={() => add(q)} to={0.94}>
                <View style={[styles.quick, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                  <Text style={{ fontFamily: Type.bodyMedium, fontSize: 13, color: palette.textSecondary }}>
                    + {localizeName(q, region)}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>
        </Reveal>

        {/* selected items */}
        {items.length > 0 && (
          <Reveal delay={120} style={{ gap: Spacing.two }}>
            <Small color={palette.textSecondary}>Your ingredients</Small>
            <View style={styles.wrap}>
              {items.map((it) => (
                <PressableScale key={it} onPress={() => remove(it)} to={0.94}>
                  <View style={[styles.chip, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}>
                    <Text style={{ fontFamily: Type.bodyMedium, fontSize: 14, color: palette.accent }}>
                      {localizeName(it, region)}  ✕
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </View>
            <Button
              title="Find dishes"
              onPress={() => setResult(cookFrom(items, household))}
              style={{ marginTop: Spacing.two }}
            />
          </Reveal>
        )}

        {/* results */}
        {result && (
          <View style={{ gap: Spacing.three }}>
            {result.excluded.length > 0 && (
              <GlassCard style={{ gap: 4 }}>
                <Small color={palette.danger} style={{ fontFamily: Type.bodySemibold }}>
                  Skipped for safety
                </Small>
                <Small>
                  {result.excluded.map((e) => `${localizeName(e.name, region)} (${e.reason})`).join(', ')}
                </Small>
              </GlassCard>
            )}

            {result.suggestions.length === 0 ? (
              <GlassCard>
                <Body style={{ fontFamily: Type.bodySemibold }}>No dishes yet</Body>
                <Small>Add a protein or two (eggs, chicken, lentils…) and a vegetable to get suggestions.</Small>
              </GlassCard>
            ) : (
              <>
                <Eyebrow>{result.suggestions.length} ideas you can cook</Eyebrow>
                {result.suggestions.map((s, i) => (
                  <Reveal key={s.meal.name} delay={i * 50}>
                    <SuggestionCard suggestion={s} region={region} />
                  </Reveal>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SuggestionCard({ suggestion, region }: { suggestion: Suggestion; region: Region }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const { meal, alsoNeed } = suggestion;
  const { emoji, colors } = mealVisual(meal.name, meal.ingredients);
  return (
    <PressableScale onPress={() => setOpen((o) => !o)} to={0.98}>
      <GlassCard style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 52, height: 52, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 26, lineHeight: 32 }}>{emoji}</Text>
          </LinearGradient>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: Type.display, fontSize: 17, color: palette.text }}>{meal.name}</Text>
            {meal.cuisine && <Small color={palette.accent}>{meal.cuisine} · tap for recipe</Small>}
          </View>
        </View>

        {alsoNeed.length > 0 && (
          <Small color={palette.textSecondary}>
            You&apos;ll also want: {alsoNeed.map((a) => localizeName(a, region)).join(', ')}
          </Small>
        )}

        {open && meal.recipe && (
          <View style={{ gap: Spacing.two, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: Spacing.three }}>
            <Small color={palette.textSecondary}>
              {meal.recipe.timeMinutes} min · serves {meal.recipe.servings}
            </Small>
            {meal.recipe.steps.map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Text style={{ fontFamily: Type.bodyBold, fontSize: 13, color: palette.accent }}>{i + 1}.</Text>
                <Body style={{ flex: 1, fontSize: 15 }}>{step}</Body>
              </View>
            ))}
          </View>
        )}
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: Spacing.two },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 52,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  addBtn: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quick: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1 },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1.5 },
});
