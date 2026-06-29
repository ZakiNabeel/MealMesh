/**
 * "Surprise me / Guests are here" — a one-tap menu generator for the moment you
 * have no plan and need ideas fast. The user (optionally) lists what's in the
 * kitchen, picks a cuisine, and flags any dietary needs at the table; we build
 * a safe, region-appropriate spread from the SAME constraint engine the weekly
 * planner uses (so it can never suggest a hard-excluded ingredient).
 *
 * Gating: a Pro-only feature — Free accounts see a clear upsell and cannot
 * generate. Guest mode additionally pulls the signed-in user's own saved
 * household constraints as a safety floor (since guests eat at the same
 * table), then asks whether the guest personally needs anything extra.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { ArticlesRail } from '@/components/ArticlesRail';
import { AppHeader } from '@/components/AppHeader';
import { FoodCarouselRail } from '@/components/FoodCarouselRail';
import { FoodImage } from '@/components/FoodImage';
import { Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Reveal, Screen, Small, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { cookFrom } from '@/lib/cookFrom';
import { localizeName, youtubeSearchUrl } from '@/lib/cuisine';
import { DIET_DEFINITIONS, REGIONS } from '@/lib/dietLibrary';
import { getDraftHousehold } from '@/lib/draft';
import { loadHousehold } from '@/lib/store';
import { buildSurpriseSpread, COURSE_LABEL, type CourseDish } from '@/lib/surpriseSpread';
import { useSubscription } from '@/lib/subscription';
import { usePalette } from '@/theme/use-theme';
import type { ConstraintKey, Household, MemberConstraint, Region } from '@/types';

const QUICK = ['eggs', 'rice', 'chicken', 'lentils', 'potato', 'onion', 'tomato', 'spinach', 'yogurt', 'chickpeas'];

// A small, common subset of the full diet library — the restrictions a guest is
// most likely to mention at short notice. Each maps to the real definition so
// the engine enforces it exactly.
const COMMON_DIETS: ConstraintKey[] = ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'diabetic'];

type Mode = 'me' | 'guests';

/** Flatten + dedupe a household's members into one safety-floor constraint
 * set (by key, keeping 'hard' over 'soft' if members disagree). */
function baselineConstraints(h: Household | null): MemberConstraint[] {
  if (!h) return [];
  const byKey = new Map<ConstraintKey, MemberConstraint>();
  for (const m of h.members) {
    for (const c of m.constraints) {
      const existing = byKey.get(c.key);
      if (!existing || (existing.severity === 'soft' && c.severity === 'hard')) byKey.set(c.key, c);
    }
  }
  return [...byKey.values()];
}

export default function Surprise() {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { isPro, loading: subLoading } = useSubscription();
  const draft = getDraftHousehold();
  // Reached via two separate header nav entries — "Guest mode" and "Surprise
  // me" — that open this same screen pre-set to a different starting mode.
  const params = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<Mode>(params.mode === 'me' ? 'me' : 'guests');
  const [region, setRegion] = useState<Region>(draft?.region ?? 'none');
  const [diets, setDiets] = useState<Set<ConstraintKey>>(new Set());
  const [items, setItems] = useState<string[]>([]);
  const [text, setText] = useState('');

  // The signed-in user's own saved household — guest mode treats its hard
  // constraints as a safety floor (the kitchen is still subject to them).
  const [household, setHousehold] = useState<Household | null>(null);
  // null = not yet answered; only meaningful in 'guests' mode.
  const [guestNeeds, setGuestNeeds] = useState<boolean | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CourseDish[] | null>(null);
  const [excluded, setExcluded] = useState<{ name: string; reason: string }[]>([]);

  useEffect(() => {
    void loadHousehold().then(setHousehold);
  }, []);

  const baseline = baselineConstraints(household);

  const switchMode = (m: Mode) => {
    setMode(m);
    setGuestNeeds(null);
    setDiets(new Set());
  };

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
    const extra: MemberConstraint[] =
      mode === 'guests' && guestNeeds === true
        ? [...diets].map((key) => ({ key, category: DIET_DEFINITIONS[key].category, severity: DIET_DEFINITIONS[key].defaultSeverity }))
        : [];
    const merged = new Map<ConstraintKey, MemberConstraint>();
    for (const c of baseline) merged.set(c.key, c);
    for (const c of extra) merged.set(c.key, c);
    return {
      id: 'surprise',
      name: mode === 'guests' ? 'Guests' : 'You',
      region,
      members: [{ id: 'guest', name: 'Guest', ageBand: 'adult', calorieTarget: null, constraints: [...merged.values()] }],
    };
  };

  const generate = async () => {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    setBusy(true);
    const built = guestHousehold();
    // Surfaces "left out for safety" messaging for any pantry item that broke
    // a household rule — the dishes themselves come from buildSurpriseSpread.
    const skipped = items.length > 0 ? cookFrom(items, built).excluded : [];
    const dishes = buildSurpriseSpread(built, Date.now() % 1000, items);

    setExcluded(skipped);
    setResult(dishes);
    setBusy(false);
  };

  const locked = !subLoading && !isPro;

  const main = (
    <View style={{ gap: Spacing.four }}>
      <Reveal>
        <Eyebrow>Surprise me</Eyebrow>
        <Heading style={{ marginTop: 4 }}>{mode === 'guests' ? 'Guests are here — what do we make?' : 'Give me an idea'}</Heading>
        <Body color={palette.textSecondary} style={{ marginTop: Spacing.two }}>
          Tell us a little and we&apos;ll plate up a quick, safe spread — built on the same engine as your weekly plan.
        </Body>
      </Reveal>

      {/* mode */}
      <Reveal delay={60} style={[styles.tabs, { backgroundColor: palette.backgroundElement }]}>
        {(
          [
            ['guests', 'Guests are here'],
            ['me', 'Just me'],
          ] as [Mode, string][]
        ).map(([k, label]) => {
          const active = mode === k;
          return (
            <PressableScale key={k} onPress={() => switchMode(k)} to={0.97} style={{ flex: 1 }}>
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

      {/* household safety floor */}
      {baseline.length > 0 && (
        <Reveal delay={130}>
          <GlassCard style={{ gap: 4, backgroundColor: palette.backgroundElement }}>
            <Small style={{ fontFamily: Type.bodySemibold }}>Using your household&apos;s saved dietary needs</Small>
            <Small color={palette.textSecondary}>
              {baseline.map((c) => DIET_DEFINITIONS[c.key].label).join(', ')} — applied automatically so the kitchen stays safe.
            </Small>
          </GlassCard>
        </Reveal>
      )}

      {/* dietary — guest mode only; "just me" already inherits the household above */}
      {mode === 'guests' && (
        <Reveal delay={140} style={{ gap: Spacing.two }}>
          <Small color={palette.textSecondary}>Does your guest have any dietary needs we should know about?</Small>
          <View style={styles.wrap}>
            <Chip label="No, nothing extra" selected={guestNeeds === false} onPress={() => setGuestNeeds(false)} />
            <Chip label="Yes, let me add some" selected={guestNeeds === true} onPress={() => setGuestNeeds(true)} />
          </View>
          {guestNeeds === true && (
            <View style={styles.wrap}>
              {COMMON_DIETS.map((k) => (
                <Chip key={k} label={DIET_DEFINITIONS[k].label} tone="blue" selected={diets.has(k)} onPress={() => toggleDiet(k)} />
              ))}
            </View>
          )}
        </Reveal>
      )}

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

      {/* Pro gate */}
      {locked && (
        <Reveal delay={210}>
          <GlassCard style={{ gap: Spacing.two, borderWidth: 1.5, borderColor: palette.accent, backgroundColor: palette.accentMuted }}>
            <Body style={{ fontFamily: Type.bodySemibold }}>Surprise Me is a Pro feature</Body>
            <Small color={palette.textSecondary}>
              Guest spreads and quick personal ideas are unlocked with MealMesh Pro, along with unlimited weekly plans.
            </Small>
            <Button title="Go Pro ✦" onPress={() => router.push('/paywall')} />
          </GlassCard>
        </Reveal>
      )}

      {/* generate */}
      <Reveal delay={220} style={{ gap: Spacing.two }}>
        <Button
          title={busy ? 'Plating up…' : locked ? 'Surprise us! (Pro)' : mode === 'guests' ? 'Surprise us!' : 'Surprise me!'}
          disabled={busy || locked || subLoading}
          onPress={generate}
        />
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
              <Eyebrow>{mode === 'guests' ? 'Your guest spread' : 'Your spread'}</Eyebrow>
              {result.map((dish, i) => (
                <Reveal key={`${dish.course}-${i}`} delay={i * 50}>
                  <DishCard dish={dish} region={region} />
                </Reveal>
              ))}
              <Button title={mode === 'guests' ? 'Surprise us again' : 'Another idea'} variant="secondary" onPress={generate} disabled={busy} />
            </>
          )}
        </View>
      )}
    </View>
  );

  return (
    <Screen art={Art.tacos} wide maxWidth={1280} header={<AppHeader active={mode === 'me' ? 'surprise' : 'guest'} />}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.three }}>
        {isDesktop ? (
          <View style={styles.row}>
            <View style={styles.leftRail}>
              <ArticlesRail />
            </View>
            <View style={styles.main}>{main}</View>
            <View style={styles.rail}>
              <FoodCarouselRail region={region} />
            </View>
          </View>
        ) : (
          main
        )}
      </ScrollView>
    </Screen>
  );
}

function DishCard({ dish, region }: { dish: CourseDish; region: Region }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <PressableScale onPress={() => setOpen((o) => !o)} to={0.98}>
      <GlassCard style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
          <FoodImage name={dish.name} ingredients={dish.ingredients} style={{ width: 56, height: 56 }} emojiSize={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Small color={palette.textSecondary} style={{ fontFamily: Type.bodySemibold, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
              {COURSE_LABEL[dish.course]}
            </Small>
            <Text style={{ fontFamily: Type.display, fontSize: 17, color: palette.text }}>{localizeName(dish.name, region)}</Text>
            {dish.cuisine && <Small color={palette.accent}>{dish.cuisine} · tap for recipe</Small>}
          </View>
        </View>

        {open && dish.recipe && (
          <View style={{ gap: Spacing.two, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: Spacing.three }}>
            <Small color={palette.textSecondary}>
              {dish.recipe.timeMinutes} min · serves {dish.recipe.servings}
            </Small>
            {dish.recipe.steps.map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Text style={{ fontFamily: Type.bodyBold, fontSize: 13, color: palette.accent }}>{i + 1}.</Text>
                <Body style={{ flex: 1, fontSize: 15 }}>{step}</Body>
              </View>
            ))}
            <PressableScale onPress={() => Linking.openURL(youtubeSearchUrl(dish.name))} to={0.98}>
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
  row: { flexDirection: 'row', gap: Spacing.four, alignItems: 'flex-start' },
  leftRail: { width: 280, flexShrink: 0, gap: Spacing.four },
  main: { flex: 1.6, minWidth: 0, gap: Spacing.four },
  rail: { width: 280, flexShrink: 0, gap: Spacing.four },
});
