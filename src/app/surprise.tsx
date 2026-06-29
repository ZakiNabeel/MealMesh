/**
 * "Surprise me / Guests are here" — a one-tap menu generator for the moment you
 * have no plan and need ideas fast. The user (optionally) lists what's in the
 * kitchen, picks a cuisine, and flags any dietary needs at the table; we build
 * a safe, region-appropriate spread from the SAME constraint engine the weekly
 * planner uses (so it can never suggest a hard-excluded ingredient).
 *
 * Gating: free accounts get one surprise per week; Pro is unlimited.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { AppHeader } from '@/components/AppHeader';
import { FoodImage } from '@/components/FoodImage';
import { Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { cookFrom, type Suggestion } from '@/lib/cookFrom';
import { localizeName, youtubeSearchUrl } from '@/lib/cuisine';
import { DIET_DEFINITIONS, REGIONS } from '@/lib/dietLibrary';
import { getDraftHousehold } from '@/lib/draft';
import { generateMockPlan } from '@/lib/mockPlan';
import { FREE_WEEKLY_SURPRISES, bumpSurprises, surprisesThisWeek, useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import type { ConstraintKey, Household, MemberConstraint, PlannedMeal, Region } from '@/types';

const QUICK = ['eggs', 'rice', 'chicken', 'lentils', 'potato', 'onion', 'tomato', 'spinach', 'yogurt', 'chickpeas'];

// A small, common subset of the full diet library — the restrictions a guest is
// most likely to mention at short notice. Each maps to the real definition so
// the engine enforces it exactly.
const COMMON_DIETS: ConstraintKey[] = ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'diabetic'];

type Mode = 'me' | 'guests';

export default function Surprise() {
  const router = useRouter();
  const palette = usePalette();
  const { isPro } = useSubscription();
  const draft = getDraftHousehold();

  const [mode, setMode] = useState<Mode>('guests');
  const [region, setRegion] = useState<Region>(draft?.region ?? 'none');
  const [diets, setDiets] = useState<Set<ConstraintKey>>(new Set());
  const [items, setItems] = useState<string[]>([]);
  const [text, setText] = useState('');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlannedMeal[] | null>(null);
  const [excluded, setExcluded] = useState<{ name: string; reason: string }[]>([]);
  const [usesLeft, setUsesLeft] = useState<number | null>(null);

  useEffect(() => {
    void surprisesThisWeek().then((n) => setUsesLeft(Math.max(0, FREE_WEEKLY_SURPRISES - n)));
  }, []);

  const add = (raw: string) => {
    const v = raw.trim().toLowerCase();
    if (!v) return;
    setItems((prev) => (prev.some((p) => p.toLowerCase() === v) ? prev : [...prev, v]));
    setText('');
  };
  const remove = (name: string) => setItems((prev) => prev.filter((p) => p !== name));
  const toggleDiet = (k: ConstraintKey) =>
    setDiets((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const guestHousehold = (): Household => {
    const constraints: MemberConstraint[] = [...diets].map((key) => ({
      key,
      category: DIET_DEFINITIONS[key].category,
      severity: DIET_DEFINITIONS[key].defaultSeverity,
    }));
    return {
      id: 'surprise',
      name: mode === 'guests' ? 'Guests' : 'You',
      region,
      members: [{ id: 'guest', name: 'Guest', ageBand: 'adult', calorieTarget: null, constraints }],
    };
  };

  const generate = async () => {
    // Gate: free users get one per week; Pro is unlimited.
    if (!isPro) {
      const used = await surprisesThisWeek();
      if (used >= FREE_WEEKLY_SURPRISES) {
        router.push('/paywall');
        return;
      }
    }
    setBusy(true);
    const household = guestHousehold();
    const count = mode === 'guests' ? 5 : 3;
    let meals: PlannedMeal[] = [];
    let skipped: { name: string; reason: string }[] = [];

    if (items.length > 0) {
      // Build around what they actually have on hand.
      const res = cookFrom(items, household);
      meals = res.suggestions.map((s) => s.meal).slice(0, count);
      skipped = res.excluded;
    }
    if (meals.length < count) {
      // Top up (or fully fill, when no ingredients were given) with a fresh
      // region-appropriate spread from the planner engine. Lead with the
      // substantial meals — a guest spread shouldn't open with a breakfast.
      const plan = generateMockPlan(household, Date.now() % 1000);
      const priority: PlannedMeal['slot'][] = mode === 'guests' ? ['dinner', 'lunch', 'supper'] : ['dinner', 'lunch', 'supper', 'breakfast'];
      const ranked = plan.days
        .filter((m) => priority.includes(m.slot))
        .sort((a, b) => priority.indexOf(a.slot) - priority.indexOf(b.slot));
      const seen = new Set(meals.map((m) => m.name));
      for (const m of ranked) {
        if (meals.length >= count) break;
        if (seen.has(m.name)) continue;
        seen.add(m.name);
        meals.push(m);
      }
    }

    if (!isPro) {
      const n = await bumpSurprises();
      setUsesLeft(Math.max(0, FREE_WEEKLY_SURPRISES - n));
    }
    setExcluded(skipped);
    setResult(meals);
    setBusy(false);
  };

  const limited = !isPro && usesLeft !== null && usesLeft <= 0;

  return (
    <Screen art={Art.tacos} header={<AppHeader active="surprise" />}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.three, gap: Spacing.four }}>
        <Reveal>
          <Eyebrow>Surprise me ✨</Eyebrow>
          <Heading style={{ marginTop: 4 }}>{mode === 'guests' ? 'Guests are here — what do we make?' : 'Give me an idea'}</Heading>
          <Body color={palette.textSecondary} style={{ marginTop: Spacing.two }}>
            Tell us a little and we&apos;ll plate up a quick, safe spread — built on the same engine as your weekly plan.
          </Body>
        </Reveal>

        {/* mode */}
        <Reveal delay={60} style={[styles.tabs, { backgroundColor: palette.backgroundElement }]}>
          {(
            [
              ['guests', '🎉 Guests are here'],
              ['me', '🍽️ Just me'],
            ] as [Mode, string][]
          ).map(([k, label]) => {
            const active = mode === k;
            return (
              <PressableScale key={k} onPress={() => setMode(k)} to={0.97} style={{ flex: 1 }}>
                <View style={[styles.tab, active && { backgroundColor: palette.card }]}>
                  <Text style={{ fontFamily: active ? Type.bodySemibold : Type.bodyMedium, fontSize: 14, color: active ? palette.accent : palette.textSecondary }}>{label}</Text>
                </View>
              </PressableScale>
            );
          })}
        </Reveal>

        {/* cuisine */}
        <Reveal delay={100} style={{ gap: Spacing.two }}>
          <Small color={palette.textSecondary}>What are we in the mood for?</Small>
          <View style={styles.wrap}>
            {Object.values(REGIONS).map((r) => (
              <Chip key={r.region} label={r.label} selected={region === r.region} onPress={() => setRegion(r.region)} />
            ))}
          </View>
        </Reveal>

        {/* dietary */}
        <Reveal delay={140} style={{ gap: Spacing.two }}>
          <Small color={palette.textSecondary}>Anyone at the table need this avoided?</Small>
          <View style={styles.wrap}>
            {COMMON_DIETS.map((k) => (
              <Chip key={k} label={DIET_DEFINITIONS[k].label} tone="blue" selected={diets.has(k)} onPress={() => toggleDiet(k)} />
            ))}
          </View>
        </Reveal>

        {/* ingredients (optional) */}
        <Reveal delay={180} style={{ gap: Spacing.two }}>
          <Small color={palette.textSecondary}>Got ingredients to use up? (optional)</Small>
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
          <View style={styles.wrap}>
            {QUICK.filter((q) => !items.includes(q)).map((q) => (
              <PressableScale key={q} onPress={() => add(q)} to={0.94}>
                <View style={[styles.quick, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                  <Text style={{ fontFamily: Type.bodyMedium, fontSize: 13, color: palette.textSecondary }}>+ {localizeName(q, region)}</Text>
                </View>
              </PressableScale>
            ))}
          </View>
          {items.length > 0 && (
            <View style={styles.wrap}>
              {items.map((it) => (
                <PressableScale key={it} onPress={() => remove(it)} to={0.94}>
                  <View style={[styles.chip, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}>
                    <Text style={{ fontFamily: Type.bodyMedium, fontSize: 14, color: palette.accent }}>{localizeName(it, region)}  ✕</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
        </Reveal>

        {/* generate */}
        <Reveal delay={220} style={{ gap: Spacing.two }}>
          <Button
            title={busy ? 'Plating up…' : limited ? '✦ Out of free surprises — Go Pro' : mode === 'guests' ? '🎉 Surprise us!' : '✨ Surprise me!'}
            disabled={busy}
            onPress={generate}
          />
          {!isPro && usesLeft !== null && (
            <Small color={palette.textSecondary} style={{ textAlign: 'center' }}>
              {usesLeft > 0 ? `${usesLeft} free surprise${usesLeft === 1 ? '' : 's'} left this week · unlimited on Pro` : 'Pro members get unlimited surprises every week.'}
            </Small>
          )}
        </Reveal>

        {busy && (
          <View style={{ alignItems: 'center', paddingVertical: Spacing.four }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        )}

        {/* result */}
        {result && !busy && (
          <View style={{ gap: Spacing.three }}>
            {excluded.length > 0 && (
              <GlassCard style={{ gap: 4 }}>
                <Small color={palette.danger} style={{ fontFamily: Type.bodySemibold }}>Left out for safety</Small>
                <Small>{excluded.map((e) => `${localizeName(e.name, region)} (${e.reason})`).join(', ')}</Small>
              </GlassCard>
            )}
            {result.length === 0 ? (
              <GlassCard>
                <Body style={{ fontFamily: Type.bodySemibold }}>Hmm, nothing safe to suggest</Body>
                <Small>Try fewer restrictions or a different cuisine.</Small>
              </GlassCard>
            ) : (
              <>
                <Eyebrow>{mode === 'guests' ? 'Your guest spread' : 'Cook one of these'}</Eyebrow>
                {result.map((meal, i) => (
                  <Reveal key={`${meal.name}-${i}`} delay={i * 50}>
                    <DishCard meal={meal} region={region} />
                  </Reveal>
                ))}
                <Button title={mode === 'guests' ? 'Surprise us again' : 'Another idea'} variant="secondary" onPress={generate} disabled={busy} />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function DishCard({ meal, region }: { meal: PlannedMeal; region: Region }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <PressableScale onPress={() => setOpen((o) => !o)} to={0.98}>
      <GlassCard style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
          <FoodImage name={meal.name} ingredients={meal.ingredients} style={{ width: 56, height: 56 }} emojiSize={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: Type.display, fontSize: 17, color: palette.text }}>{localizeName(meal.name, region)}</Text>
            {meal.cuisine && <Small color={palette.accent}>{meal.cuisine} · tap for recipe</Small>}
          </View>
        </View>

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
            <PressableScale onPress={() => Linking.openURL(youtubeSearchUrl(meal.name))} to={0.98}>
              <Small color={palette.blue} style={{ fontFamily: Type.bodySemibold, marginTop: Spacing.one }}>▶  Watch recipe on YouTube</Small>
            </PressableScale>
          </View>
        )}
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 4 },
  tab: { height: 42, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
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
