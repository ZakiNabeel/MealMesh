import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Art } from '@/components/art';
import { FoodImage } from '@/components/FoodImage';
import { MeshMark } from '@/components/MeshMark';
import { SheetModal } from '@/components/SheetModal';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { weeklyLocal } from '@/lib/budget';
import { localizeName, youtubeSearchUrl } from '@/lib/cuisine';
import { getDraftHousehold, setDraftHousehold } from '@/lib/draft';
import { currencySymbol, formatMoney } from '@/lib/geo';
import { generatePlan } from '@/lib/generatePlan';
import { currentWeekStart, loadHousehold, loadPlan, savePlan, saveHousehold } from '@/lib/store';
import { bumpGenerations, FREE_WEEKLY_PLANS, generationsThisWeek, useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import { MEAL_SLOTS, type DayOfWeek, type Household, type MealPlan, type MealSlot, type PlannedMeal, type Region } from '@/types';

const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  supper: 'Supper',
  dinner: 'Dinner',
};

export default function Plan() {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session, loading: authLoading } = useAuth();
  const { isPro } = useSubscription();

  const [household, setHousehold] = useState<Household | null>(getDraftHousehold());
  const [resolving, setResolving] = useState(true);
  const [seed, setSeed] = useState(0);
  const [tab, setTab] = useState<'plan' | 'grocery'>('plan');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PlannedMeal | null>(null);

  // Resolve the working household: persist a guest's draft once signed in, or
  // load the saved one on return. Runs before generation so we never call Claude
  // twice (once as a draft, once after persisting).
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setResolving(true);
      const draft = getDraftHousehold();
      let resolved: Household | null = draft;
      if (session) {
        if (draft && draft.id === 'draft') {
          resolved = (await saveHousehold(draft)) ?? draft;
        } else if (!draft) {
          resolved = await loadHousehold();
        }
      }
      if (cancelled) return;
      if (resolved) setDraftHousehold(resolved);
      setHousehold(resolved);
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, authLoading]);

  // Generate (or load a saved) plan once the household is resolved.
  useEffect(() => {
    if (resolving || !household) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const week = currentWeekStart();
      const persisted = Boolean(session) && household.id !== 'draft';
      let result: MealPlan | null = null;
      // On first view, prefer the saved plan (no Claude call / no cost). A
      // regenerate (seed > 0) always asks for a fresh one and overwrites it.
      if (persisted && seed === 0) result = await loadPlan(household.id, week);
      if (!result) {
        result = await generatePlan(household, seed, Boolean(session));
        if (persisted) await savePlan(household.id, week, result);
      }
      if (!cancelled) {
        setPlan(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, seed, resolving]);

  if (resolving) {
    return (
      <Screen art={Art.ramen}>
        <View style={styles.empty}>
          <ActivityIndicator color={palette.accent} />
          <Small color={palette.textSecondary}>Loading your household…</Small>
        </View>
      </Screen>
    );
  }

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

  const centerCol = isDesktop ? styles.centerCol : undefined;

  return (
    <Screen art={Art.ramen} wide style={isDesktop ? { maxWidth: 1180 } : undefined}>
      {/* header + tabs — kept to a comfortable width even on a wide desktop */}
      <View style={centerCol}>
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
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.three, gap: Spacing.three }}>
        {!plan ? (
          <View style={styles.empty}>
            <ActivityIndicator color={palette.accent} />
            <Small color={palette.textSecondary}>Weaving this week&apos;s plan…</Small>
          </View>
        ) : tab === 'plan' ? (
          <>
            {isDesktop ? (
              <View style={styles.dashboardRow}>
                <View style={styles.rail}>
                  <PlanSummaryRail plan={plan} household={household} />
                </View>
                <DayCards plan={plan} isDesktop={isDesktop} onSelect={setSelected} />
              </View>
            ) : (
              <>
                <View style={{ gap: Spacing.three }}>
                  <BudgetBanner plan={plan} country={household.country} budgetWeekly={household.budgetWeekly} />
                  <Small color={palette.accent} style={{ fontFamily: Type.bodyMedium }}>
                    ✓ Every dish checked against your household&apos;s rules
                  </Small>
                </View>
                <DayCards plan={plan} isDesktop={isDesktop} onSelect={setSelected} />
              </>
            )}
            {!session && (
              <View style={[centerCol, { marginTop: Spacing.one }]}>
                <GlassCard style={{ gap: Spacing.two }}>
                  <Body style={{ fontFamily: Type.bodySemibold }}>Save this plan</Body>
                  <Small>Sign in to keep your plans and sync across devices.</Small>
                  <Button title="Sign in" variant="secondary" onPress={() => router.push('/auth')} />
                </GlassCard>
              </View>
            )}
          </>
        ) : (
          <View style={centerCol}>
            <GroceryList plan={plan} region={household.region} checked={checked} setChecked={setChecked} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, centerCol]}>
        <Button
          title="Regenerate this week"
          variant="secondary"
          disabled={loading}
          onPress={async () => {
            if (!isPro) {
              const used = await generationsThisWeek();
              if (used >= FREE_WEEKLY_PLANS - 1) {
                router.push('/paywall');
                return;
              }
              await bumpGenerations();
            }
            setPlan(null);
            setSeed((s) => s + 1);
          }}
        />
        <PressableScale onPress={() => router.push('/pantry')} to={0.97}>
          <Small color={palette.accent} style={{ textAlign: 'center', marginTop: Spacing.three, fontFamily: Type.bodySemibold }}>
            🥘  Cook with what I have
          </Small>
        </PressableScale>
      </View>

      <RecipeModal meal={selected} region={household.region} onClose={() => setSelected(null)} />
    </Screen>
  );
}

/** The 7 day-cards, as a wrapping grid on desktop or a single stacked column on mobile. */
function DayCards({
  plan,
  isDesktop,
  onSelect,
}: {
  plan: MealPlan;
  isDesktop: boolean;
  onSelect: (m: PlannedMeal) => void;
}) {
  return (
    <View style={isDesktop ? styles.dayGrid : { gap: Spacing.three }}>
      {DAY_ORDER.map((day, i) => {
        const meals = plan.days.filter((m) => m.dayOfWeek === day);
        if (!meals.length) return null;
        return (
          <View key={day} style={isDesktop ? styles.dayCol : undefined}>
            <Reveal delay={i * 40}>
              <DayGroup day={day} meals={meals} onSelect={onSelect} />
            </Reveal>
          </View>
        );
      })}
    </View>
  );
}

const PROTEIN_KEYWORDS = [
  'chicken', 'beef', 'lamb', 'mutton', 'turkey', 'fish', 'salmon', 'shrimp', 'prawn',
  'tofu', 'paneer', 'lentil', 'chickpea', 'bean', 'egg', 'yogurt',
];

/** Tally the household's most-used proteins this week, for the "at a glance" rail. */
function proteinMix(plan: MealPlan): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const meal of plan.days) {
    const seen = new Set<string>();
    for (const ing of meal.ingredients) {
      const lower = ing.toLowerCase();
      const hit = PROTEIN_KEYWORDS.find((k) => lower.includes(k));
      if (hit && !seen.has(hit)) {
        seen.add(hit);
        counts.set(hit, (counts.get(hit) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({ label: cap(label), count }));
}

/** Desktop-only left rail: budget gauge + a "this week at a glance" summary,
 *  so a wide viewport reads as a dashboard instead of two day-cards in empty space. */
function PlanSummaryRail({ plan, household }: { plan: MealPlan; household: Household }) {
  const palette = usePalette();
  const total = plan.days.length;
  const shared = plan.days.filter((m) => m.sharedOrVariant === 'shared').length;
  const variants = total - shared;
  const sharedPct = total > 0 ? shared / total : 0;
  const proteins = proteinMix(plan);

  return (
    <View style={{ gap: Spacing.three }}>
      <BudgetBanner plan={plan} country={household.country} budgetWeekly={household.budgetWeekly} />

      <GlassCard style={{ gap: Spacing.three }}>
        <Eyebrow>This week at a glance</Eyebrow>

        <View style={styles.glanceRow}>
          <Small color={palette.textSecondary}>Meals planned</Small>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 15, color: palette.text }}>{total}</Text>
        </View>

        <View style={{ gap: 6 }}>
          <View style={styles.glanceRow}>
            <Small color={palette.textSecondary}>Shared vs. personalized</Small>
            <Small style={{ fontFamily: Type.bodyMedium }}>
              {shared} shared · {variants} variant{variants === 1 ? '' : 's'}
            </Small>
          </View>
          <View style={[styles.splitTrack, { backgroundColor: palette.blueMuted }]}>
            <View style={[styles.splitFill, { width: `${sharedPct * 100}%`, backgroundColor: palette.accent }]} />
          </View>
        </View>

        {proteins.length > 0 && (
          <View style={{ gap: Spacing.two }}>
            <Small color={palette.textSecondary}>Protein mix</Small>
            <View style={styles.tagRow}>
              {proteins.map((p) => (
                <View key={p.label} style={[styles.tag, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                  <Text style={{ fontFamily: Type.bodyMedium, fontSize: 12, color: palette.text }}>
                    {p.label} · {p.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </GlassCard>

      <Small color={palette.accent} style={{ fontFamily: Type.bodyMedium }}>
        ✓ Every dish checked against your household&apos;s rules
      </Small>
    </View>
  );
}

/** Square dish thumbnail — real photo if a Pexels key is set, else emoji tile. */
function FoodTile({ meal, size = 56 }: { meal: PlannedMeal; size?: number }) {
  return (
    <FoodImage
      name={meal.name}
      ingredients={meal.ingredients}
      style={{ width: size, height: size }}
      emojiSize={size * 0.5}
    />
  );
}

/** Estimated weekly grocery spend, shown in the household's local currency. */
function BudgetBanner({ plan, country, budgetWeekly }: { plan: MealPlan; country?: string; budgetWeekly?: number }) {
  const palette = usePalette();
  // Estimate is already in local currency, calibrated to local food prices.
  const estLocal = weeklyLocal(plan, country);
  const within = budgetWeekly != null ? estLocal <= budgetWeekly : null;
  return (
    <GlassCard style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <View style={[styles.budgetIcon, { backgroundColor: palette.accentMuted }]}>
          <Text style={{ fontSize: 20 }}>🧾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>Est. weekly groceries</Eyebrow>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontFamily: Type.displayBold, fontSize: 26, color: palette.text }}
          >
            {formatMoney(estLocal, country)}
          </Text>
        </View>
        <Small color={palette.textSecondary} style={{ maxWidth: 64, textAlign: 'right' }}>
          approx{'\n'}/ week
        </Small>
      </View>
      {budgetWeekly != null && (
        <View style={[styles.budgetTag, { backgroundColor: within ? palette.accentMuted : palette.blueMuted }]}>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 12, color: within ? palette.accent : palette.blue }}>
            {within
              ? `✓ Within your ${currencySymbol(country)}${budgetWeekly.toLocaleString()} budget`
              : `Just over your ${currencySymbol(country)}${budgetWeekly.toLocaleString()} budget — Regenerate for cheaper picks`}
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

/** One day with its four meals (breakfast → dinner) as tappable rows. */
function DayGroup({
  day,
  meals,
  onSelect,
}: {
  day: DayOfWeek;
  meals: PlannedMeal[];
  onSelect: (m: PlannedMeal) => void;
}) {
  const palette = usePalette();
  const ordered = MEAL_SLOTS.map((slot) => meals.find((m) => m.slot === slot)).filter(Boolean) as PlannedMeal[];
  return (
    <View style={{ gap: Spacing.two }}>
      <Eyebrow>{DAY_FULL[day]}</Eyebrow>
      <GlassCard style={{ gap: 0, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one }}>
        {ordered.map((meal, i) => (
          <MealRow
            key={meal.slot}
            meal={meal}
            divider={i > 0}
            onPress={() => onSelect(meal)}
          />
        ))}
      </GlassCard>
    </View>
  );
}

function MealRow({ meal, divider, onPress }: { meal: PlannedMeal; divider: boolean; onPress: () => void }) {
  const palette = usePalette();
  const shared = meal.sharedOrVariant === 'shared';
  return (
    <PressableScale onPress={onPress} to={0.99}>
      <View style={[styles.mealRow, divider && { borderTopWidth: 1, borderTopColor: palette.border }]}>
        <FoodTile meal={meal} size={46} />
        <View style={{ flex: 1, gap: 2 }}>
          <Small color={palette.textSecondary} style={{ fontFamily: Type.bodySemibold }}>
            {SLOT_LABEL[meal.slot]}
          </Small>
          <Text numberOfLines={1} style={{ fontFamily: Type.display, fontSize: 16, color: palette.text }}>
            {meal.name}
          </Text>
        </View>
        <View style={[styles.dot, { backgroundColor: shared ? palette.accent : palette.blue }]} />
      </View>
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

/** Recipe detail dialog: hero, meta, ingredients, numbered steps. */
function RecipeModal({ meal, region, onClose }: { meal: PlannedMeal | null; region: Region; onClose: () => void }) {
  const palette = usePalette();
  return (
    <SheetModal visible={Boolean(meal)} onClose={onClose} maxWidth={560}>
      {meal && (
        <ScrollView showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: Spacing.four }}>
          <FoodImage name={meal.name} ingredients={meal.ingredients} style={styles.hero} radius={0} emojiSize={64} />

          <View style={{ padding: Spacing.four, gap: Spacing.three }}>
            <View style={{ gap: 4 }}>
              <Eyebrow>
                {SLOT_LABEL[meal.slot]} · {DAY_FULL[meal.dayOfWeek]}
                {meal.cuisine ? ` · ${meal.cuisine}` : ''}
              </Eyebrow>
              <Heading>{meal.name}</Heading>
            </View>

            <PressableScale onPress={() => Linking.openURL(youtubeSearchUrl(meal.name))} to={0.98}>
              <View style={[styles.ytBtn, { borderColor: palette.border, backgroundColor: palette.card }]}>
                <View style={styles.ytIcon}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11 }}>▶</Text>
                </View>
                <Text style={{ fontFamily: Type.bodySemibold, fontSize: 15, color: palette.text }}>Watch recipe on YouTube</Text>
              </View>
            </PressableScale>

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
                    <Text style={{ fontFamily: Type.bodyMedium, fontSize: 13, color: palette.text }}>
                      {localizeName(ing, region)}
                    </Text>
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
      )}
    </SheetModal>
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
  region,
  checked,
  setChecked,
}: {
  plan: MealPlan;
  region: Region;
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
                      {cap(localizeName(item.name, region))}
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
  centerCol: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  dashboardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  rail: { width: 300, flexShrink: 0 },
  dayGrid: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  dayCol: { flexGrow: 1, flexBasis: '31%', minWidth: 260 },
  glanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitTrack: { height: 8, borderRadius: 999, overflow: 'hidden', width: '100%' },
  splitFill: { height: '100%', borderRadius: 999 },
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
  budgetIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  budgetTag: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 8 },
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
  hero: { height: 150, width: '100%', alignItems: 'center', justifyContent: 'center' },
  ytBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, height: 48, borderRadius: Radius.pill, borderWidth: 1.5 },
  ytIcon: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#FF0000', alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  metaPill: { flex: 1, gap: 2, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.md },
});
