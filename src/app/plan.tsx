import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { MeshMark } from '@/components/MeshMark';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { mealVisual } from '@/lib/cuisine';
import { getDraftHousehold } from '@/lib/draft';
import { generatePlan } from '@/lib/generatePlan';
import { usePalette } from '@/theme/use-theme';
import type { DayOfWeek, MealPlan, PlannedMeal } from '@/types';

const DAY_LABEL: Record<DayOfWeek, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
  saturday: 'SAT',
  sunday: 'SUN',
};

export default function Plan() {
  const router = useRouter();
  const palette = usePalette();
  const { session } = useAuth();
  const household = getDraftHousehold();

  const [seed, setSeed] = useState(0);
  const [tab, setTab] = useState<'plan' | 'grocery'>('plan');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PlannedMeal | null>(null);

  useEffect(() => {
    if (!household) return;
    let cancelled = false;
    setLoading(true);
    generatePlan(household, seed, Boolean(session)).then((next) => {
      if (!cancelled) {
        setPlan(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, seed, Boolean(session)]);

  if (!household) {
    return (
      <Screen art={Art.ramen}>
        <View style={styles.empty}>
          <MeshMark size={120} />
          <Heading>No plan yet</Heading>
          <Body color={palette.textSecondary} style={{ textAlign: 'center' }}>
            Tell us about your household and we&apos;ll weave one plan everyone can eat.
          </Body>
          <Button title="Start setup" onPress={() => router.replace('/onboarding')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen art={Art.ramen}>
      {/* header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>This week</Eyebrow>
          <Heading numberOfLines={1}>{household.name}</Heading>
        </View>
        <PressableScale onPress={() => router.push('/settings')} to={0.9}>
          <View style={[styles.iconBtn, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontSize: 16 }}>⚙︎</Text>
          </View>
        </PressableScale>
      </View>

      {/* tabs */}
      <View style={[styles.tabs, { backgroundColor: palette.backgroundElement }]}>
        {(['plan', 'grocery'] as const).map((t) => {
          const active = tab === t;
          return (
            <PressableScale key={t} onPress={() => setTab(t)} to={0.97} style={{ flex: 1 }}>
              <View style={[styles.tab, active && { backgroundColor: palette.card }]}>
                <Text
                  style={{
                    fontFamily: active ? Type.bodySemibold : Type.bodyMedium,
                    fontSize: 14,
                    color: active ? palette.accent : palette.textSecondary,
                  }}
                >
                  {t === 'plan' ? 'Meal plan' : 'Grocery list'}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.three, gap: Spacing.three }}>
        {!plan ? (
          <View style={styles.empty}>
            <ActivityIndicator color={palette.accent} />
            <Small color={palette.textSecondary}>Weaving this week&apos;s plan…</Small>
          </View>
        ) : tab === 'plan' ? (
          <>
            <Small color={palette.accent} style={{ fontFamily: Type.bodyMedium }}>
              ✓ Every dish checked against your household&apos;s rules
            </Small>
            {plan.days.map((meal, i) => (
              <Reveal key={meal.dayOfWeek} delay={i * 50}>
                <DayCard meal={meal} onPress={() => setSelected(meal)} />
              </Reveal>
            ))}
            {!session && (
              <GlassCard style={{ gap: Spacing.two, marginTop: Spacing.one }}>
                <Body style={{ fontFamily: Type.bodySemibold }}>Save this plan</Body>
                <Small>Sign in to keep your plans and sync across devices.</Small>
                <Button title="Sign in" variant="secondary" onPress={() => router.push('/auth')} />
              </GlassCard>
            )}
          </>
        ) : (
          <GroceryList plan={plan} checked={checked} setChecked={setChecked} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Regenerate this week"
          variant="secondary"
          disabled={loading}
          onPress={() => {
            setPlan(null);
            setSeed((s) => s + 1);
          }}
        />
        <Small color={palette.textSecondary} style={{ textAlign: 'center', marginTop: Spacing.two }}>
          {session ? 'Generated by Claude, checked against your rules.' : 'Sign in for AI-generated plans — every dish is safety-checked.'}
        </Small>
      </View>

      <RecipeModal meal={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

/** Square gradient tile with a food glyph — always loads, no network. */
function FoodTile({ meal, size = 56 }: { meal: PlannedMeal; size?: number }) {
  const { emoji, colors } = mealVisual(meal.name, meal.ingredients);
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </LinearGradient>
  );
}

function DayCard({ meal, onPress }: { meal: PlannedMeal; onPress: () => void }) {
  const palette = usePalette();
  const shared = meal.sharedOrVariant === 'shared';
  const badgeColor = shared ? palette.accent : palette.blue;
  const badgeBg = shared ? palette.accentMuted : palette.blueMuted;
  const tags = meal.satisfies.slice(0, 2);
  return (
    <PressableScale onPress={onPress} to={0.98}>
      <GlassCard style={{ gap: Spacing.two }}>
        <View style={styles.dayTop}>
          <Eyebrow>{DAY_LABEL[meal.dayOfWeek]}</Eyebrow>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 12, color: badgeColor }}>
              {shared ? 'One shared dish' : 'Simple variations'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
          <FoodTile meal={meal} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: Type.display, fontSize: 18, lineHeight: 23, color: palette.text }}>{meal.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
              {meal.cuisine && <Small color={palette.accent}>{meal.cuisine}</Small>}
              {meal.recipe && <Small>· {meal.recipe.timeMinutes} min · recipe ›</Small>}
            </View>
          </View>
        </View>
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((k) => (
              <View key={k} style={[styles.tag, { borderColor: palette.border }]}>
                <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.textSecondary }}>
                  ✓ {k.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
            {meal.satisfies.length > 2 && (
              <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.textSecondary, alignSelf: 'center' }}>
                +{meal.satisfies.length - 2}
              </Text>
            )}
          </View>
        )}
      </GlassCard>
    </PressableScale>
  );
}

const DAY_FULL: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** Bottom-sheet recipe detail: hero, meta, ingredients, numbered steps. */
function RecipeModal({ meal, onClose }: { meal: PlannedMeal | null; onClose: () => void }) {
  const palette = usePalette();
  if (!meal) return null;
  const { emoji, colors } = mealVisual(meal.name, meal.ingredients);
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.six }}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={{ fontSize: 64, lineHeight: 76, textAlign: 'center' }}>{emoji}</Text>
          </LinearGradient>

          <View style={{ padding: Spacing.four, gap: Spacing.three }}>
            <View style={{ gap: 4 }}>
              {meal.cuisine && <Eyebrow>{meal.cuisine} · {DAY_FULL[meal.dayOfWeek]}</Eyebrow>}
              <Heading>{meal.name}</Heading>
            </View>

            {meal.recipe && (
              <View style={{ flexDirection: 'row', gap: Spacing.three }}>
                <MetaPill label="Time" value={`${meal.recipe.timeMinutes} min`} />
                <MetaPill label="Serves" value={`${meal.recipe.servings}`} />
                <MetaPill label="Type" value={meal.sharedOrVariant === 'shared' ? 'Shared' : 'Variations'} />
              </View>
            )}

            {meal.satisfies.length > 0 && (
              <View style={styles.tagRow}>
                {meal.satisfies.map((k) => (
                  <View key={k} style={[styles.tag, { borderColor: palette.border, backgroundColor: palette.accentMuted }]}>
                    <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.accent }}>
                      ✓ {k.replace(/_/g, ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ gap: Spacing.two }}>
              <Eyebrow>Ingredients</Eyebrow>
              <View style={styles.tagRow}>
                {meal.ingredients.map((ing) => (
                  <View key={ing} style={[styles.tag, { borderColor: palette.border, backgroundColor: palette.card }]}>
                    <Text style={{ fontFamily: Type.bodyMedium, fontSize: 13, color: palette.text }}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>

            {meal.recipe && (
              <View style={{ gap: Spacing.two }}>
                <Eyebrow>Method</Eyebrow>
                <View style={{ gap: Spacing.three }}>
                  {meal.recipe.steps.map((step, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: Spacing.three }}>
                      <View style={[styles.stepNum, { backgroundColor: palette.accent }]}>
                        <Text style={{ fontFamily: Type.bodyBold, fontSize: 13, color: palette.onAccent }}>{i + 1}</Text>
                      </View>
                      <Body style={{ flex: 1 }}>{step}</Body>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Button title="Close" variant="secondary" onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.metaPill, { backgroundColor: palette.backgroundElement }]}>
      <Small color={palette.textSecondary}>{label}</Small>
      <Text style={{ fontFamily: Type.bodySemibold, fontSize: 15, color: palette.text }}>{value}</Text>
    </View>
  );
}

function GroceryList({
  plan,
  checked,
  setChecked,
}: {
  plan: MealPlan;
  checked: Record<string, boolean>;
  setChecked: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const palette = usePalette();
  const grouped = useMemo(() => {
    const map = new Map<string, typeof plan.grocery>();
    for (const item of plan.grocery) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return [...map.entries()];
  }, [plan]);

  return (
    <View style={{ gap: Spacing.four }}>
      {grouped.map(([category, items]) => (
        <View key={category} style={{ gap: Spacing.two }}>
          <Eyebrow>{category}</Eyebrow>
          <GlassCard style={{ gap: 0, paddingVertical: Spacing.one }}>
            {items.map((item, i) => {
              const on = checked[item.name];
              return (
                <PressableScale
                  key={item.name}
                  onPress={() => setChecked((p) => ({ ...p, [item.name]: !p[item.name] }))}
                  to={0.99}
                >
                  <View style={[styles.groceryRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.border }]}>
                    <View
                      style={[
                        styles.check,
                        on
                          ? { backgroundColor: palette.accent, borderColor: palette.accent }
                          : { borderColor: palette.border },
                      ]}
                    >
                      {on && <Text style={{ color: palette.onAccent, fontSize: 12 }}>✓</Text>}
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: Type.bodyMedium,
                        fontSize: 15,
                        color: on ? palette.textSecondary : palette.text,
                        textDecorationLine: on ? 'line-through' : 'none',
                      }}
                    >
                      {item.name}
                    </Text>
                    <Small>{item.quantity}</Small>
                  </View>
                </PressableScale>
              );
            })}
          </GlassCard>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  iconBtn: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 4, marginTop: Spacing.three },
  tab: { height: 42, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeDot: { width: 7, height: 7, borderRadius: 7 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingVertical: Spacing.three },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: 'rgba(127,127,127,0.4)', marginTop: 10, marginBottom: 4 },
  hero: { height: 150, alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  metaPill: { flex: 1, gap: 2, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.md },
});
