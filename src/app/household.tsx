import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Art } from '@/components/art';
import { CountryPicker } from '@/components/CountryPicker';
import { CuisineMixPicker } from '@/components/CuisineMixPicker';
import { Body, Button, Chip, Eyebrow, GlassCard, Heading, PressableScale, Screen, Small, useIsDesktop } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { constraintsByCategory, makeConstraint } from '@/lib/constraints';
import { normalizeCuisineMix } from '@/lib/cuisineMix';
import { getDraftHousehold, setDraftHousehold } from '@/lib/draft';
import { countryByCode, currencySymbol } from '@/lib/geo';
import { loadHousehold, saveHousehold } from '@/lib/store';
import { usePalette } from '@/theme/use-theme';
import type { AgeBand, ConstraintCategory, ConstraintKey, CuisineWeight, Household, Member, Region } from '@/types';

type DraftMember = { id: string; name: string; ageBand: AgeBand; keys: ConstraintKey[] };

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: 'adult', label: 'Adult' },
  { value: 'teen', label: 'Teen' },
  { value: 'child', label: 'Child' },
];

const CATEGORY_META: Record<ConstraintCategory, { title: string; tone: 'green' | 'blue' }> = {
  religious: { title: 'Religious & cultural', tone: 'green' },
  lifestyle: { title: 'Lifestyle', tone: 'green' },
  medical: { title: 'Medical', tone: 'blue' },
  allergen: { title: 'Allergens', tone: 'blue' },
};

const HEALTH_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: 'Not really' },
  { value: 2, label: 'A little' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Very' },
  { value: 5, label: 'Extremely' },
];

let idSeq = 0;
const nextId = () => `new${++idSeq}`;

/**
 * Edit-in-place for an existing household — unlike onboarding (a one-time
 * stepped wizard for building one from scratch), this is a single page
 * pre-filled with the current values so editing the cuisine or adding one
 * member doesn't mean re-entering everyone and everything.
 */
export default function HouseholdEdit() {
  const router = useRouter();
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const { session, loading: authLoading } = useAuth();
  const groups = useMemo(() => constraintsByCategory(), []);

  const [resolving, setResolving] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string>('draft');

  const [name, setName] = useState('');
  const [cuisines, setCuisines] = useState<CuisineWeight[]>([{ region: 'none', percent: 100 }]);
  const dominantRegion: Region = cuisines.reduce((a, b) => (b.percent > a.percent ? b : a)).region;
  const [country, setCountry] = useState('');
  const [budget, setBudget] = useState('');
  const [healthConsciousness, setHealthConsciousness] = useState(3);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState<AgeBand>('adult');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      const existing = session ? await loadHousehold() : getDraftHousehold();
      if (cancelled) return;
      if (existing) {
        setExistingId(existing.id);
        setName(existing.name);
        setCuisines(normalizeCuisineMix(existing.region, existing.cuisines));
        setCountry(existing.country ?? '');
        setBudget(existing.budgetWeekly ? String(existing.budgetWeekly) : '');
        setHealthConsciousness(existing.healthConsciousness ?? 3);
        setMembers(
          existing.members.map((m) => ({ id: m.id, name: m.name, ageBand: m.ageBand, keys: m.constraints.map((c) => c.key) })),
        );
      }
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, authLoading]);

  function addMember() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const m: DraftMember = { id: nextId(), name: trimmed, ageBand: newAge, keys: [] };
    setMembers((prev) => [...prev, m]);
    setExpandedId(m.id);
    setNewName('');
    setNewAge('adult');
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function toggleKey(memberId: string, key: ConstraintKey) {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, keys: m.keys.includes(key) ? m.keys.filter((k) => k !== key) : [...m.keys, key] } : m)),
    );
  }

  async function onSave() {
    const built: Member[] = members.map((m) => ({
      id: m.id,
      name: m.name || 'Member',
      ageBand: m.ageBand,
      calorieTarget: null,
      constraints: m.keys.map((k) => makeConstraint(k)),
    }));
    const household: Household = {
      id: existingId,
      name: name.trim() || 'Our household',
      region: dominantRegion,
      cuisines: cuisines.length > 1 ? cuisines : undefined,
      country: country || undefined,
      currency: country ? countryByCode(country).currency : undefined,
      budgetWeekly: budget ? Number(budget) : undefined,
      healthConsciousness,
      members: built,
    };
    setSaving(true);
    // Persist to the DB when signed in (saveHousehold upserts the one household
    // per user, so a 'draft' id is fine — it finds or creates the real row).
    const saved = session ? await saveHousehold(household) : null;
    // ALWAYS refresh the in-memory draft — settings and the plan screen read
    // getDraftHousehold() first, so without this the stale draft would mask the
    // edit and the next plan would ignore the change. Use the reloaded DB row
    // (real ids) when we have it, else the just-built household.
    setDraftHousehold(saved ?? household);
    setSaving(false);
    router.back();
  }

  const canSave = name.trim().length > 0 && members.length > 0;

  if (resolving) {
    return (
      <Screen art={Art.sandwich} wide header={<AppHeader />}>
        <View style={styles.empty}>
          <ActivityIndicator color={palette.accent} />
          <Small color={palette.textSecondary}>Loading your household…</Small>
        </View>
      </Screen>
    );
  }

  const col = isDesktop ? styles.col : undefined;

  return (
    <Screen art={Art.sandwich} wide header={<AppHeader />}>
      <View style={styles.top}>
        <Heading>Edit household</Heading>
        <Body color={palette.textSecondary}>Change just what you need — everything else stays as it is.</Body>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}>
        <View style={isDesktop ? styles.grid : { gap: Spacing.four }}>
          <View style={[{ gap: Spacing.two }, col]}>
            <Eyebrow>Household</Eyebrow>
            <GlassCard style={{ gap: Spacing.three }}>
              <Field value={name} onChangeText={setName} placeholder="e.g. The Khan family" />
              <Body color={palette.textSecondary}>Where do you shop? (sets your currency)</Body>
              <CountryPicker
                value={country}
                onSelect={(code) => {
                  setCountry(code);
                  setCuisines((mix) => (mix.length === 1 && mix[0].region === 'none' ? [{ region: countryByCode(code).region, percent: 100 }] : mix));
                }}
              />
              {country !== '' && (
                <View style={[styles.budgetRow, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
                  <Text style={{ fontFamily: Type.bodySemibold, fontSize: 16, color: palette.textSecondary }}>
                    {currencySymbol(country)}
                  </Text>
                  <TextInput
                    value={budget}
                    onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))}
                    placeholder="Weekly grocery budget"
                    placeholderTextColor={palette.textSecondary}
                    keyboardType="number-pad"
                    style={{ flex: 1, fontFamily: Type.body, fontSize: 16, color: palette.text }}
                  />
                  <Small color={palette.textSecondary}>/ week</Small>
                </View>
              )}
            </GlassCard>
          </View>

          <View style={[{ gap: Spacing.two }, col]}>
            <Eyebrow>Cuisine preference</Eyebrow>
            <GlassCard style={{ gap: Spacing.three }}>
              <Small color={palette.textSecondary}>
                Tap to add up to 3 — e.g. mostly Pakistani with a little Chinese — and rebalance the split.
              </Small>
              <CuisineMixPicker value={cuisines} onChange={setCuisines} />
            </GlassCard>
          </View>

          <View style={[{ gap: Spacing.two }, col]}>
            <Eyebrow>Health consciousness</Eyebrow>
            <GlassCard style={{ gap: Spacing.three }}>
              <Body color={palette.textSecondary}>How health-conscious is your household? (e.g. gym-goers, macro tracking)</Body>
              <View style={styles.wrap}>
                {HEALTH_LEVELS.map((h) => (
                  <Chip key={h.value} label={h.label} tone="blue" selected={healthConsciousness === h.value} onPress={() => setHealthConsciousness(h.value)} />
                ))}
              </View>
            </GlassCard>
          </View>

          <View style={[{ gap: Spacing.two }, col]}>
            <Eyebrow>Members</Eyebrow>
            <GlassCard style={{ gap: Spacing.three }}>
              {members.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  expanded={expandedId === m.id}
                  onToggleExpand={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                  onRemove={() => removeMember(m.id)}
                  groups={groups}
                  onToggleKey={(key) => toggleKey(m.id, key)}
                />
              ))}
              <View style={{ gap: Spacing.two }}>
                <Field value={newName} onChangeText={setNewName} placeholder="Add a person…" onSubmitEditing={addMember} />
                <View style={[styles.segmented, { backgroundColor: palette.backgroundElement }]}>
                  {AGE_BANDS.map((o) => {
                    const active = o.value === newAge;
                    return (
                      <PressableScale key={o.value} onPress={() => setNewAge(o.value)} to={0.96} style={{ flex: 1 }}>
                        <View style={[styles.segment, active && { backgroundColor: palette.card }]}>
                          <Text style={{ fontFamily: active ? Type.bodySemibold : Type.bodyMedium, fontSize: 14, color: active ? palette.accent : palette.textSecondary }}>
                            {o.label}
                          </Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
                <Button title="Add person" variant="secondary" onPress={addMember} />
              </View>
            </GlassCard>
          </View>
        </View>

        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={onSave} disabled={!canSave || saving} />
      </ScrollView>
    </Screen>
  );
}

function MemberCard({
  member,
  expanded,
  onToggleExpand,
  onRemove,
  groups,
  onToggleKey,
}: {
  member: DraftMember;
  expanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  groups: { category: ConstraintCategory; items: { key: ConstraintKey; label: string }[] }[];
  onToggleKey: (key: ConstraintKey) => void;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.memberCard, { borderColor: palette.border, backgroundColor: palette.backgroundElement }]}>
      <PressableScale onPress={onToggleExpand} to={0.98}>
        <View style={styles.memberRow}>
          <View style={[styles.avatarSm, { backgroundColor: palette.accentMuted }]}>
            <Text style={{ fontFamily: Type.display, fontSize: 16, color: palette.accent }}>{(member.name.trim()[0] ?? '?').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ fontFamily: Type.bodySemibold }}>{member.name}</Body>
            <Small color={palette.textSecondary}>
              {member.ageBand} · {member.keys.length ? `${member.keys.length} diet${member.keys.length === 1 ? '' : 's'}` : 'no restrictions'}
            </Small>
          </View>
          <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.textSecondary }}>{expanded ? 'Done' : 'Edit diets'}</Text>
        </View>
      </PressableScale>

      {expanded && (
        <View style={{ gap: Spacing.three, paddingTop: Spacing.three }}>
          {groups.map(({ category, items }) => (
            <View key={category} style={{ gap: Spacing.two }}>
              <Body style={{ fontFamily: Type.bodySemibold }}>{CATEGORY_META[category].title}</Body>
              <View style={styles.wrap}>
                {items.map((d) => (
                  <Chip key={d.key} label={d.label} tone={CATEGORY_META[category].tone} selected={member.keys.includes(d.key)} onPress={() => onToggleKey(d.key)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <PressableScale onPress={onRemove} to={0.9} style={{ alignSelf: 'flex-end', marginTop: Spacing.two }}>
        <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.textSecondary }}>Remove person</Text>
      </PressableScale>
    </View>
  );
}

function Field(props: { value: string; onChangeText: (t: string) => void; placeholder: string; onSubmitEditing?: () => void }) {
  const palette = usePalette();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={palette.textSecondary}
      onSubmitEditing={props.onSubmitEditing}
      returnKeyType="done"
      style={[styles.field, { color: palette.text, backgroundColor: palette.backgroundElement, borderColor: palette.border }]}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  top: { gap: 4, paddingTop: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: Spacing.four },
  col: { flexGrow: 1, flexBasis: '45%', minWidth: 300 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  field: { fontFamily: Type.body, fontSize: 16, height: 52, borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, height: 52, borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 4 },
  segment: { height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  memberCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatarSm: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
