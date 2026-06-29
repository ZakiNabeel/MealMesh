import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { FoodImage } from '@/components/FoodImage';
import { SheetModal } from '@/components/SheetModal';
import { Body, Button, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { weeklyLocal } from '@/lib/budget';
import { localizeName, youtubeSearchUrl } from '@/lib/cuisine';
import { getDraftHousehold, setDraftHousehold } from '@/lib/draft';
import { computeStreak, summarizeWeek, type WeekSummary } from '@/lib/gamification';
import { formatMoney } from '@/lib/geo';
import { generatePlan } from '@/lib/generatePlan';
import { buildGroceryPdf, groceryPdfFileName, shareOrDownloadGroceryPdf } from '@/lib/groceryPdf';
import { pickAndUploadImage } from '@/lib/imageUpload';
import { getAllLogs, logMeal, unlogMeal } from '@/lib/social';
import { currentWeekStart, loadHousehold, loadPlan, localDateKey, savePlan, saveHousehold } from '@/lib/store';
import { bumpGenerations, FREE_WEEKLY_PLANS, generationsThisWeek, useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import { MEAL_SLOTS, type DayOfWeek, type GroceryItem, type Household, type MealLog, type MealPlan, type MealSlot, type PlannedMeal, type Region } from '@/types';

/** Key a cooking log by its plan coordinates (day + slot within the week). */
const cookKey = (day: DayOfWeek, slot: MealSlot) => `${day}|${slot}`;
const todayIso = () => localDateKey();

const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Rendering order only — rotates the canonical Monday-start list so today's
 * weekday displays first and the rest wrap around. Generation, caching and
 * the Gemini day labels all stay Monday-anchored; only what the user sees
 * changes. */
function displayDayOrder(): DayOfWeek[] {
  const todayIdx = (new Date().getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0, …
  return [...DAY_ORDER.slice(todayIdx), ...DAY_ORDER.slice(0, todayIdx)];
}

/** Calendar date for the Nth card in the rotated display order (today + n). */
function displayDate(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

const longDateLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
const weekdayShort = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' });

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  supper: 'Supper',
  dinner: 'Dinner',
};

const LOADING_QUIPS = [
  'Weaving this week’s plan…',
  'Negotiating with a picky eater…',
  'Asking the spice rack for ideas…',
  'Untangling everyone’s diets…',
  'Making sure nobody eats peanuts by accident…',
  'Swapping pork for paneer, halal-style…',
  'Counting calories so you don’t have to…',
  'Sneaking some vegetables in…',
  'Double-checking the grocery math…',
  'Simmering a 7-day plan to perfection…',
];

/** Cycles through a playful line every few seconds while a plan generates. */
function LoadingQuip() {
  const palette = usePalette();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LOADING_QUIPS.length), 1800);
    return () => clearInterval(id);
  }, []);
  return <Small color={palette.textSecondary}>{LOADING_QUIPS[i]}</Small>;
}

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
  // Which day the plan tab is focused on. Today renders first (index 0).
  const [dayIdx, setDayIdx] = useState(0);
  const dayOrder = useMemo(() => displayDayOrder(), []);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PlannedMeal | null>(null);

  // Cooking logs (the gamification loop). Loaded once per session; `cooked`
  // (this week's keys) drives the per-meal checks, while the full history feeds
  // the cross-week streak. Only signed-in users can log — guests see no checks.
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [cookTarget, setCookTarget] = useState<PlannedMeal | null>(null);
  const week = currentWeekStart();

  const refreshLogs = useCallback(async () => {
    if (!session) {
      setLogs([]);
      return;
    }
    setLogs(await getAllLogs());
  }, [session]);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  const cooked = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) if (l.weekStart === week) set.add(cookKey(l.dayOfWeek, l.slot));
    return set;
  }, [logs, week]);

  const weekSummary = useMemo<WeekSummary>(() => summarizeWeek(logs, week), [logs, week]);
  const streak = useMemo(() => computeStreak(logs, todayIso()), [logs]);

  // Optimistically reflect a just-logged/unlogged meal, then persist.
  const toggleCooked = useCallback(
    async (meal: PlannedMeal, photoUrl: string | null, caption: string | null) => {
      const saved = await logMeal({
        weekStart: week,
        dayOfWeek: meal.dayOfWeek,
        slot: meal.slot,
        mealName: meal.name,
        photoUrl,
        caption,
      });
      if (saved) await refreshLogs();
    },
    [week, refreshLogs],
  );

  const removeCooked = useCallback(
    async (meal: PlannedMeal) => {
      await unlogMeal({ weekStart: week, dayOfWeek: meal.dayOfWeek, slot: meal.slot });
      await refreshLogs();
    },
    [week, refreshLogs],
  );

  // Resolve the working household: persist a guest's draft once signed in, or
  // load the saved one on return. Runs before generation so we never call the
  // AI twice (once as a draft, once after persisting).
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
      // On first view, prefer the saved plan (no AI call / no cost). A
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
      <Screen art={Art.ramen} header={<AppHeader active="plan" />}>
        <View style={styles.empty}>
          <ActivityIndicator color={palette.accent} />
          <Small color={palette.textSecondary}>Loading your household…</Small>
        </View>
      </Screen>
    );
  }

  if (!household) {
    return (
      <Screen art={Art.ramen} header={<AppHeader active="plan" />}>
        <View style={styles.empty}>
          <Image source={require('../../assets/logo.svg')} alt="" style={{ width: 88, height: 88, borderRadius: 26 }} />
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
    <Screen art={Art.ramen} wide header={<AppHeader active="plan" />} style={isDesktop ? { maxWidth: 1180 } : undefined}>
      {/* header + tabs — kept to a comfortable width even on a wide desktop */}
      <View style={centerCol}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Eyebrow>This week</Eyebrow>
            <Heading numberOfLines={1}>{household.name}</Heading>
          </View>
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
            <LoadingQuip />
          </View>
        ) : tab === 'plan' ? (
          <>
            <DayStrip
              order={dayOrder}
              selectedIdx={dayIdx}
              onSelect={setDayIdx}
              plan={plan}
              cooked={cooked}
              canCook={Boolean(session)}
            />
            <View style={centerCol}>
              <PressableScale onPress={() => router.push('/pantry')} to={0.98}>
                <View style={[styles.cookFromHaveBanner, { borderColor: palette.accent, backgroundColor: palette.accentMuted }]}>
                  <Text style={{ fontSize: 22 }}>🥘</Text>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: Type.bodySemibold, color: palette.accent }}>Cook with what I have</Body>
                    <Small color={palette.textSecondary}>Use up ingredients already in your kitchen</Small>
                  </View>
                  <Text style={{ fontSize: 18, color: palette.accent }}>›</Text>
                </View>
              </PressableScale>
            </View>
            {isDesktop ? (
              <View style={styles.dashboardRow}>
                <View style={styles.rail}>
                  {session && <CookProgress summary={weekSummary} streak={streak.current} />}
                  <PlanSummaryRail plan={plan} household={household} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SelectedDayMeals
                    day={dayOrder[dayIdx]}
                    date={displayDate(dayIdx)}
                    plan={plan}
                    region={household.region}
                    isDesktop
                    onSelect={setSelected}
                    cooked={cooked}
                    canCook={Boolean(session)}
                    onCook={setCookTarget}
                    onUncook={removeCooked}
                  />
                </View>
              </View>
            ) : (
              <>
                <SelectedDayMeals
                  day={dayOrder[dayIdx]}
                  date={displayDate(dayIdx)}
                  plan={plan}
                  region={household.region}
                  isDesktop={false}
                  onSelect={setSelected}
                  cooked={cooked}
                  canCook={Boolean(session)}
                  onCook={setCookTarget}
                  onUncook={removeCooked}
                />
                <View style={{ gap: Spacing.three }}>
                  <BudgetBanner plan={plan} country={household.country} budgetWeekly={household.budgetWeekly} />
                  {session && <CookProgress summary={weekSummary} streak={streak.current} />}
                </View>
              </>
            )}
            {!session && (
              <View style={[centerCol, { marginTop: Spacing.one }]}>
                <GlassCard style={{ gap: Spacing.two }}>
                  <Body style={{ fontFamily: Type.bodySemibold }}>Save this plan</Body>
                  <Small>Sign in to keep your plans and sync across devices.</Small>
                  <Button title="Sign in" onPress={() => router.push('/auth')} />
                </GlassCard>
              </View>
            )}
          </>
        ) : (
          <View style={[centerCol, { gap: Spacing.three }]}>
            <GroceryView
              plan={plan}
              region={household.region}
              household={household}
              isPro={isPro}
              checked={checked}
              setChecked={setChecked}
              dayOrder={dayOrder}
            />
          </View>
        )}

        <View style={isDesktop && tab === 'plan' ? styles.footerRow : undefined}>
          {isDesktop && tab === 'plan' && <View style={styles.rail} />}
          <View style={[styles.footer, centerCol, isDesktop && tab === 'plan' && { flex: 1, marginHorizontal: 0 }]}>
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
          </View>
        </View>
      </ScrollView>

      <RecipeModal meal={selected} region={household.region} onClose={() => setSelected(null)} />
      <CookSheet
        meal={cookTarget}
        onClose={() => setCookTarget(null)}
        onConfirm={async (photoUrl, caption) => {
          if (cookTarget) await toggleCooked(cookTarget, photoUrl, caption);
          setCookTarget(null);
        }}
      />
    </Screen>
  );
}

/** This week's cooking progress: points, badges, and streak — gives the
 *  numbers room to breathe (nav to leaderboard/community lives in the header). */
function CookProgress({ summary, streak }: { summary: WeekSummary; streak: number }) {
  const palette = usePalette();
  const total = DAY_ORDER.length * MEAL_SLOTS.length; // 28
  const pct = total > 0 ? summary.mealsCooked / total : 0;
  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>Your week</Eyebrow>
        <View style={[styles.streakPill, { backgroundColor: streak > 0 ? palette.accentMuted : palette.backgroundElement }]}>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 12, color: streak > 0 ? palette.accent : palette.textSecondary }}>
            {streak > 0 ? `🔥 ${streak}-day streak` : 'Start a streak today'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.three }}>
        <View>
          <Text style={{ fontFamily: Type.displayBold, fontSize: 32, color: palette.text }}>{summary.points}</Text>
          <Small color={palette.textSecondary}>points this week</Small>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Small color={palette.textSecondary}>{summary.mealsCooked}/{total} meals cooked</Small>
          <Small color={palette.textSecondary}>{summary.cleanPlateDays.length}/7 clean plates</Small>
        </View>
      </View>

      {/* progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: palette.backgroundElement }]}>
        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: palette.accent }]} />
      </View>

      {summary.perfectWeek ? (
        <Small color={palette.accent} style={{ fontFamily: Type.bodySemibold }}>🏆 Perfect Week — every meal cooked!</Small>
      ) : (
        <Small color={palette.textSecondary}>Tap ✓ on a meal once you&apos;ve cooked it.</Small>
      )}
    </GlassCard>
  );
}

/** Bottom sheet to log a cooked meal with an optional photo + caption. */
function CookSheet({
  meal,
  onClose,
  onConfirm,
}: {
  meal: PlannedMeal | null;
  onClose: () => void;
  onConfirm: (photoUrl: string | null, caption: string | null) => Promise<void>;
}) {
  const palette = usePalette();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state whenever a new meal is targeted.
  useEffect(() => {
    if (meal) {
      setPhotoUrl(null);
      setCaption('');
      setError(null);
    }
  }, [meal]);

  const addPhoto = async () => {
    setUploading(true);
    setError(null);
    const res = await pickAndUploadImage('meal-photos');
    setUploading(false);
    if ('url' in res) setPhotoUrl(res.url);
    else if ('error' in res) setError(res.error);
  };

  return (
    <SheetModal visible={Boolean(meal)} onClose={onClose} maxWidth={460}>
      {meal && (
        <View style={{ padding: Spacing.four, gap: Spacing.three }}>
          <View style={{ gap: 2 }}>
            <Eyebrow>{SLOT_LABEL[meal.slot]} · I made this</Eyebrow>
            <Heading numberOfLines={2}>{meal.name}</Heading>
          </View>

          {photoUrl ? (
            <Image source={{ uri: photoUrl }} resizeMode="cover" style={styles.cookPhoto} />
          ) : (
            <PressableScale onPress={addPhoto} to={0.98} disabled={uploading}>
              <View style={[styles.photoDrop, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                {uploading ? (
                  <ActivityIndicator color={palette.accent} />
                ) : (
                  <>
                    <Text style={{ fontSize: 26 }}>📸</Text>
                    <Small color={palette.textSecondary} style={{ fontFamily: Type.bodySemibold }}>
                      Add a photo (optional)
                    </Small>
                  </>
                )}
              </View>
            </PressableScale>
          )}

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="How did it turn out? (optional)"
            placeholderTextColor={palette.textSecondary}
            multiline
            style={[styles.captionInput, { borderColor: palette.border, color: palette.text, backgroundColor: palette.card }]}
          />

          {error && <Small color={palette.blue}>{error}</Small>}

          <Button
            title={saving ? 'Saving…' : 'Mark as cooked'}
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              await onConfirm(photoUrl, caption.trim() || null);
              setSaving(false);
            }}
          />
        </View>
      )}
    </SheetModal>
  );
}

/** Horizontal week strip — a tappable pill per day with its cooked progress.
 *  Keeps the whole week glanceable while the detail below stays focused. */
function DayStrip({
  order,
  selectedIdx,
  onSelect,
  plan,
  cooked,
  canCook,
}: {
  order: DayOfWeek[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  plan: MealPlan;
  cooked: Set<string>;
  canCook: boolean;
}) {
  const palette = usePalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
      {order.map((day, i) => {
        const date = displayDate(i);
        const meals = plan.days.filter((m) => m.dayOfWeek === day);
        const total = meals.length || MEAL_SLOTS.length;
        const done = canCook ? meals.filter((m) => cooked.has(cookKey(m.dayOfWeek, m.slot))).length : 0;
        const active = i === selectedIdx;
        return (
          <PressableScale key={day} onPress={() => onSelect(i)} to={0.95}>
            <View
              style={[
                styles.dayPill,
                active
                  ? { backgroundColor: palette.accent, borderColor: palette.accent }
                  : { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={{ fontFamily: Type.bodySemibold, fontSize: 11, color: active ? palette.onAccent : palette.textSecondary }}>
                {i === 0 ? 'Today' : weekdayShort(date)}
              </Text>
              <Text style={{ fontFamily: Type.displayBold, fontSize: 20, color: active ? palette.onAccent : palette.text }}>
                {date.getDate()}
              </Text>
              <View style={styles.dayDots}>
                {Array.from({ length: total }).map((_, k) => {
                  const filled = canCook && k < done;
                  return (
                    <View
                      key={k}
                      style={[
                        styles.dayDot,
                        {
                          backgroundColor: filled
                            ? active
                              ? palette.onAccent
                              : palette.accent
                            : active
                              ? palette.onAccent + '55'
                              : palette.border,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/** The focused day: its four meals as rich, photo-forward cards. */
function SelectedDayMeals({
  day,
  date,
  plan,
  region,
  isDesktop,
  onSelect,
  cooked,
  canCook,
  onCook,
  onUncook,
}: {
  day: DayOfWeek;
  date: Date;
  plan: MealPlan;
  region: Region;
  isDesktop: boolean;
  onSelect: (m: PlannedMeal) => void;
  cooked: Set<string>;
  canCook: boolean;
  onCook: (m: PlannedMeal) => void;
  onUncook: (m: PlannedMeal) => void;
}) {
  const palette = usePalette();
  const meals = MEAL_SLOTS.map((slot) => plan.days.find((m) => m.dayOfWeek === day && m.slot === slot)).filter(Boolean) as PlannedMeal[];
  const doneCount = canCook ? meals.filter((m) => cooked.has(cookKey(m.dayOfWeek, m.slot))).length : 0;
  const allDone = canCook && doneCount === meals.length && meals.length > 0;

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Eyebrow>{DAY_FULL[day]}</Eyebrow>
          <Text style={{ fontFamily: Type.display, fontSize: 22, color: palette.text }}>{longDateLabel(date)}</Text>
        </View>
        {canCook && (
          <View style={[styles.dayProgress, allDone && { backgroundColor: palette.accentMuted }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 12, color: allDone ? palette.accent : palette.textSecondary }}>
              {allDone ? '✓ Clean plate' : `${doneCount}/${meals.length} cooked`}
            </Text>
          </View>
        )}
      </View>

      <View style={isDesktop ? styles.mealGrid : { gap: Spacing.three }}>
        {meals.map((meal, i) => (
          <View key={meal.slot} style={isDesktop ? styles.mealCardCol : undefined}>
            <Reveal delay={i * 60}>
              <MealCard
                meal={meal}
                region={region}
                isCooked={cooked.has(cookKey(meal.dayOfWeek, meal.slot))}
                canCook={canCook}
                onPress={() => onSelect(meal)}
                onCook={() => onCook(meal)}
                onUncook={() => onUncook(meal)}
              />
            </Reveal>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A single meal as a photo-forward card: image banner, dish name, and the
 *  diet tags it satisfies, with a cook check overlaid on the photo. */
function MealCard({
  meal,
  region,
  isCooked,
  canCook,
  onPress,
  onCook,
  onUncook,
}: {
  meal: PlannedMeal;
  region: Region;
  isCooked: boolean;
  canCook: boolean;
  onPress: () => void;
  onCook: () => void;
  onUncook: () => void;
}) {
  const palette = usePalette();
  const shared = meal.sharedOrVariant === 'shared';
  const tags = meal.satisfies.slice(0, 2);
  return (
    <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
      <PressableScale onPress={onPress} to={0.99}>
        <View>
          <FoodImage name={meal.name} ingredients={meal.ingredients} style={styles.cardPhoto} radius={0} emojiSize={44} />
          <View style={[styles.slotBadge, { backgroundColor: palette.background + 'E6', borderColor: palette.border }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 11, color: palette.text }}>{SLOT_LABEL[meal.slot]}</Text>
          </View>
        </View>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text numberOfLines={1} style={{ fontFamily: Type.display, fontSize: 17, color: palette.text }}>
            {localizeName(meal.name, region)}
          </Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { borderColor: 'transparent', backgroundColor: shared ? palette.accentMuted : palette.blueMuted }]}>
              <Text style={{ fontFamily: Type.bodyMedium, fontSize: 11, color: shared ? palette.accent : palette.blue }}>
                {shared ? 'Shared dish' : 'Personalized'}
              </Text>
            </View>
            {tags.map((k) => (
              <View key={k} style={[styles.tag, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
                <Text style={{ fontFamily: Type.bodyMedium, fontSize: 11, color: palette.textSecondary }}>✓ {k.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
      {canCook && (
        <PressableScale onPress={isCooked ? onUncook : onCook} to={0.85} style={styles.cardCook}>
          <View
            style={[
              styles.cookCheck,
              { borderColor: isCooked ? palette.accent : palette.border, backgroundColor: isCooked ? palette.accent : palette.background + 'E6' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isCooked ? `Mark ${meal.name} as not cooked` : `I made ${meal.name}`}
          >
            <Text style={{ fontSize: 15, color: isCooked ? palette.onAccent : palette.textSecondary, fontFamily: Type.bodySemibold }}>
              {isCooked ? '✓' : '+'}
            </Text>
          </View>
        </PressableScale>
      )}
    </GlassCard>
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


/** Estimated weekly grocery spend, shown in the household's local currency. */
function BudgetBanner({ plan, country, budgetWeekly }: { plan: MealPlan; country?: string; budgetWeekly?: number }) {
  const palette = usePalette();
  // Estimate is already in local currency, calibrated to local food prices.
  const estLocal = weeklyLocal(plan, country);
  const within = budgetWeekly != null ? estLocal <= budgetWeekly : null;
  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <View style={[styles.budgetIcon, { backgroundColor: palette.accentMuted }]}>
          <Text style={{ fontSize: 20 }}>🧾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>Est. weekly groceries</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontFamily: Type.displayBold, fontSize: 26, color: palette.text }}
            >
              {formatMoney(estLocal, country)}
            </Text>
            <Small color={palette.textSecondary}>approx / week</Small>
          </View>
        </View>
      </View>
      {budgetWeekly != null && (
        <View style={[styles.budgetTag, { backgroundColor: within ? palette.accentMuted : palette.blueMuted }]}>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 12, color: within ? palette.accent : palette.blue }}>
            {within
              ? `✓ Within your ${formatMoney(budgetWeekly, country)} budget`
              : `Just over your ${formatMoney(budgetWeekly, country)} budget — Regenerate for cheaper picks`}
          </Text>
        </View>
      )}
    </GlassCard>
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

/** Grocery list with a scope selector — buy for the whole week, one day, or a
 *  single meal. Day/meal views list just the ingredients those meals need. */
type GroceryScope = 'week' | 'day' | 'meal';

function GroceryView({
  plan,
  region,
  household,
  isPro,
  checked,
  setChecked,
  dayOrder,
}: {
  plan: MealPlan;
  region: Region;
  household: Household;
  isPro: boolean;
  checked: Record<string, boolean>;
  setChecked: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  dayOrder: DayOfWeek[];
}) {
  const palette = usePalette();
  const [scope, setScope] = useState<GroceryScope>('week');
  const [dayI, setDayI] = useState(0);
  const [slot, setSlot] = useState<MealSlot>('dinner');

  // Category for any ingredient, learned from the whole-week list the engine
  // already grouped — so day/meal views slot into the same headers.
  const categoryOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of plan.grocery) m.set(g.name.toLowerCase(), g.category);
    return (name: string) => m.get(name.toLowerCase()) ?? 'Other';
  }, [plan]);

  const selDay = dayOrder[dayI];

  const items: GroceryItem[] = useMemo(() => {
    if (scope === 'week') return plan.grocery;
    const sortItems = (arr: GroceryItem[]) =>
      arr.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    if (scope === 'day') {
      const meals = plan.days.filter((m) => m.dayOfWeek === selDay);
      const counts = new Map<string, number>();
      for (const m of meals) for (const ing of new Set(m.ingredients)) counts.set(ing, (counts.get(ing) ?? 0) + 1);
      return sortItems(
        [...counts.entries()].map(([name, n]) => ({ name: cap(name), category: categoryOf(name), quantity: n > 1 ? `${n} meals` : '' })),
      );
    }
    const meal = plan.days.find((m) => m.dayOfWeek === selDay && m.slot === slot);
    if (!meal) return [];
    return sortItems([...new Set(meal.ingredients)].map((name) => ({ name: cap(name), category: categoryOf(name), quantity: '' })));
  }, [scope, selDay, slot, plan, categoryOf]);

  const scopeLabel = scope === 'week' ? 'whole week' : scope === 'day' ? DAY_FULL[selDay] : `${DAY_FULL[selDay]} · ${SLOT_LABEL[slot]}`;

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={[styles.tabs, { backgroundColor: palette.backgroundElement, marginTop: 0 }]}>
        {(
          [
            ['week', 'Whole week'],
            ['day', 'By day'],
            ['meal', 'By meal'],
          ] as [GroceryScope, string][]
        ).map(([k, label]) => {
          const active = scope === k;
          return (
            <PressableScale key={k} onPress={() => setScope(k)} to={0.97} style={{ flex: 1 }}>
              <View style={[styles.tab, active && { backgroundColor: palette.card }]}>
                <Text style={{ fontFamily: active ? Type.bodySemibold : Type.bodyMedium, fontSize: 13, color: active ? palette.accent : palette.textSecondary }}>
                  {label}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {scope !== 'week' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRow}>
          {dayOrder.map((day, i) => {
            const active = i === dayI;
            const date = displayDate(i);
            return (
              <PressableScale key={day} onPress={() => setDayI(i)} to={0.95}>
                <View style={[styles.scopeChip, active ? { backgroundColor: palette.accentMuted, borderColor: palette.accent } : { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={{ fontFamily: Type.bodyMedium, fontSize: 13, color: active ? palette.accent : palette.text }}>
                    {i === 0 ? 'Today' : weekdayShort(date)} {date.getDate()}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}

      {scope === 'meal' && (
        <View style={styles.scopeWrap}>
          {MEAL_SLOTS.map((s) => {
            const active = slot === s;
            return (
              <PressableScale key={s} onPress={() => setSlot(s)} to={0.95}>
                <View style={[styles.scopeChip, active ? { backgroundColor: palette.accentMuted, borderColor: palette.accent } : { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={{ fontFamily: Type.bodyMedium, fontSize: 13, color: active ? palette.accent : palette.text }}>{SLOT_LABEL[s]}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      )}

      <GroceryExportAction items={items} region={region} household={household} isPro={isPro} scopeLabel={scopeLabel} />
      <GroceryList items={items} region={region} checked={checked} setChecked={setChecked} />
    </View>
  );
}

function GroceryExportAction({
  items,
  region,
  household,
  isPro,
  scopeLabel,
}: {
  items: GroceryItem[];
  region: Region;
  household: Household;
  isPro: boolean;
  scopeLabel: string;
}) {
  const router = useRouter();
  const palette = usePalette();
  const [status, setStatus] = useState<'idle' | 'working' | 'shared' | 'downloaded'>('idle');

  const onPress = async () => {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    setStatus('working');
    const blob = buildGroceryPdf(items, region, `${household.name} — ${scopeLabel}`);
    const fileName = groceryPdfFileName(household.name);
    const { shared } = await shareOrDownloadGroceryPdf(blob, fileName);
    setStatus(shared ? 'shared' : 'downloaded');
    setTimeout(() => setStatus('idle'), 2500);
  };

  const label =
    status === 'working'
      ? 'Preparing…'
      : status === 'shared'
        ? 'Shared ✓'
        : status === 'downloaded'
          ? 'Downloaded ✓'
          : isPro
            ? '⬇ Export / Share PDF'
            : '🔒 Export PDF — Pro';

  return (
    <PressableScale onPress={onPress} to={0.97} disabled={status === 'working'}>
      <View
        style={[
          styles.exportRow,
          { borderColor: palette.border, backgroundColor: isPro ? palette.accentMuted : palette.backgroundElement },
        ]}
      >
        <Small style={{ fontFamily: Type.bodySemibold, color: isPro ? palette.accent : palette.textSecondary }}>{label}</Small>
        {!isPro && <Small color={palette.textSecondary}>Upgrade to export</Small>}
      </View>
    </PressableScale>
  );
}

function GroceryList({
  items,
  region,
  checked,
  setChecked,
}: {
  items: GroceryItem[];
  region: Region;
  checked: Record<string, boolean>;
  setChecked: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const palette = usePalette();
  const grouped = useMemo(() => {
    const map = new Map<string, GroceryItem[]>();
    for (const item of items) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return [...map.entries()];
  }, [items]);

  if (items.length === 0) {
    return (
      <GlassCard>
        <Small color={palette.textSecondary}>Nothing to buy for this selection.</Small>
      </GlassCard>
    );
  }

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
  dayStrip: { flexDirection: 'row', gap: Spacing.two, paddingVertical: 4, paddingRight: Spacing.two },
  dayPill: { width: 62, minHeight: 76, paddingVertical: Spacing.two, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayDots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dayDot: { width: 5, height: 5, borderRadius: 5 },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  mealCardCol: { flexGrow: 1, flexBasis: '46%', minWidth: 280 },
  cardPhoto: { width: '100%', height: 124 },
  slotBadge: { position: 'absolute', top: Spacing.two, left: Spacing.two, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  cardCook: { position: 'absolute', top: Spacing.two, right: Spacing.two },
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
  scopeRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: 2 },
  scopeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  scopeChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1 },
  exportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingVertical: Spacing.three },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  cookFromHaveBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1.5 },
  budgetIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  budgetTag: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
  cookCheck: { width: 34, height: 34, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayProgress: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 999 },
  streakPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  cookPhoto: { width: '100%', height: 200, borderRadius: Radius.md },
  photoDrop: { height: 120, borderRadius: Radius.md, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  captionInput: { minHeight: 64, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, fontFamily: Type.body, fontSize: 15, textAlignVertical: 'top' },
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
