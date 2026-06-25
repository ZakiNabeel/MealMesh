import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Art } from '@/components/art';
import { CountryPicker } from '@/components/CountryPicker';
import { Body, Button, Chip, Eyebrow, Heading, PressableScale, ProgressBar, Reveal, Screen, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { constraintsByCategory, makeConstraint } from '@/lib/constraints';
import { REGIONS } from '@/lib/dietLibrary';
import { setDraftHousehold } from '@/lib/draft';
import { countryByCode, currencySymbol } from '@/lib/geo';
import { usePalette } from '@/theme/use-theme';
import type { AgeBand, ConstraintCategory, ConstraintKey, Household, Member, Region } from '@/types';

type DraftMember = { id: string; name: string; ageBand: AgeBand; keys: ConstraintKey[] };

const STEPS = ['household', 'members', 'diets', 'review'] as const;
type Step = (typeof STEPS)[number];

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

let idSeq = 0;
const nextId = () => `m${++idSeq}`;

export default function Onboarding() {
  const router = useRouter();
  const palette = usePalette();
  const groups = useMemo(() => constraintsByCategory(), []);

  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];

  const [householdName, setHouseholdName] = useState('');
  const [region, setRegion] = useState<Region>('none');
  const [country, setCountry] = useState<string>('');
  const [budget, setBudget] = useState('');
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // members-step form
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState<AgeBand>('adult');

  const activeMember = members.find((m) => m.id === activeId) ?? members[0] ?? null;

  function addMember() {
    const name = newName.trim();
    if (!name) return;
    const m: DraftMember = { id: nextId(), name, ageBand: newAge, keys: [] };
    setMembers((prev) => [...prev, m]);
    setActiveId(m.id);
    setNewName('');
    setNewAge('adult');
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function toggleKey(memberId: string, key: ConstraintKey) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, keys: m.keys.includes(key) ? m.keys.filter((k) => k !== key) : [...m.keys, key] }
          : m,
      ),
    );
  }

  const canContinue =
    step === 'household'
      ? householdName.trim().length > 0
      : step === 'members'
        ? members.length > 0
        : true;

  function onBack() {
    if (stepIndex === 0) router.back();
    else setStepIndex((i) => i - 1);
  }

  function onNext() {
    if (step === 'review') {
      const built: Member[] = members.map((m) => ({
        id: m.id,
        name: m.name || 'Member',
        ageBand: m.ageBand,
        calorieTarget: null,
        constraints: m.keys.map((k) => makeConstraint(k)),
      }));
      const household: Household = {
        id: 'draft',
        name: householdName.trim() || 'Our household',
        region,
        country: country || undefined,
        currency: country ? countryByCode(country).currency : undefined,
        budgetWeekly: budget ? Number(budget) : undefined,
        members: built,
      };
      setDraftHousehold(household);
      router.push('/plan');
      return;
    }
    if (step === 'members' && !activeId && members[0]) setActiveId(members[0].id);
    setStepIndex((i) => i + 1);
  }

  return (
    <Screen art={Art.sandwich}>
      {/* header */}
      <View style={styles.header}>
        <PressableScale onPress={onBack} to={0.9}>
          <View style={[styles.back, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ fontFamily: Type.bodySemibold, fontSize: 18, color: palette.text }}>‹</Text>
          </View>
        </PressableScale>
        <View style={{ flex: 1, gap: 8 }}>
          <ProgressBar value={(stepIndex + 1) / STEPS.length} />
          <Small>{`Step ${stepIndex + 1} of ${STEPS.length}`}</Small>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: Spacing.four, gap: Spacing.four }}
      >
        <Reveal key={step}>
          {step === 'household' && (
            <View style={{ gap: Spacing.four }}>
              <View style={{ gap: Spacing.one }}>
                <Eyebrow>Your household</Eyebrow>
                <Heading>What should we call your table?</Heading>
              </View>
              <Field
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder="e.g. The Khan family"
                autoFocus
              />
              <View style={{ gap: Spacing.two }}>
                <Body color={palette.textSecondary}>Where do you shop? (sets your currency)</Body>
                <CountryPicker
                  value={country}
                  onSelect={(code) => {
                    setCountry(code);
                    setRegion(countryByCode(code).region); // pre-pick a cuisine; user can change below
                  }}
                />
              </View>

              {country !== '' && (
                <View style={{ gap: Spacing.two }}>
                  <Body color={palette.textSecondary}>Weekly grocery budget? (optional — we&apos;ll plan to fit)</Body>
                  <View style={[styles.budgetRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={{ fontFamily: Type.bodySemibold, fontSize: 16, color: palette.textSecondary }}>
                      {currencySymbol(country)}
                    </Text>
                    <TextInput
                      value={budget}
                      onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 8000"
                      placeholderTextColor={palette.textSecondary}
                      keyboardType="number-pad"
                      style={{ flex: 1, fontFamily: Type.body, fontSize: 16, color: palette.text }}
                    />
                    <Small color={palette.textSecondary}>/ week</Small>
                  </View>
                </View>
              )}
              <View style={{ gap: Spacing.two }}>
                <Body color={palette.textSecondary}>Lean the plan toward a cuisine?</Body>
                <View style={styles.wrap}>
                  {Object.values(REGIONS).map((r) => (
                    <Chip
                      key={r.region}
                      label={r.label}
                      selected={region === r.region}
                      onPress={() => setRegion(r.region)}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 'members' && (
            <View style={{ gap: Spacing.four }}>
              <View style={{ gap: Spacing.one }}>
                <Eyebrow>Who eats here?</Eyebrow>
                <Heading>Add everyone at the table</Heading>
                <Body color={palette.textSecondary}>
                  Each person can have their own diet — we merge them into one safe plan.
                </Body>
              </View>

              <View style={{ gap: Spacing.two }}>
                <Field value={newName} onChangeText={setNewName} placeholder="Name" onSubmitEditing={addMember} />
                <Segmented
                  options={AGE_BANDS}
                  value={newAge}
                  onChange={setNewAge}
                />
                <Button title="Add person" variant="secondary" onPress={addMember} />
              </View>

              <View style={{ gap: Spacing.two }}>
                {members.map((m) => (
                  <MemberRow key={m.id} member={m} onRemove={() => removeMember(m.id)} />
                ))}
              </View>
            </View>
          )}

          {step === 'diets' && (
            <View style={{ gap: Spacing.four }}>
              <View style={{ gap: Spacing.one }}>
                <Eyebrow>Diets & needs</Eyebrow>
                <Heading>Tap what fits each person</Heading>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatars}>
                {members.map((m) => (
                  <PressableScale key={m.id} onPress={() => setActiveId(m.id)} to={0.92}>
                    <View style={{ alignItems: 'center', gap: 6, width: 64 }}>
                      <View
                        style={[
                          styles.avatar,
                          activeMember?.id === m.id
                            ? { backgroundColor: palette.accent, borderColor: palette.accent }
                            : { backgroundColor: palette.card, borderColor: palette.border },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: Type.display,
                            fontSize: 20,
                            color: activeMember?.id === m.id ? palette.onAccent : palette.text,
                          }}
                        >
                          {(m.name.trim()[0] ?? '?').toUpperCase()}
                        </Text>
                      </View>
                      <Small numberOfLines={1}>{m.keys.length ? `${m.keys.length} set` : 'none'}</Small>
                    </View>
                  </PressableScale>
                ))}
              </ScrollView>

              {activeMember && (
                <View style={{ gap: Spacing.four }}>
                  {groups.map(({ category, items }) => (
                    <View key={category} style={{ gap: Spacing.two }}>
                      <Body style={{ fontFamily: Type.bodySemibold }}>{CATEGORY_META[category].title}</Body>
                      <View style={styles.wrap}>
                        {items.map((d) => (
                          <Chip
                            key={d.key}
                            label={d.label}
                            tone={CATEGORY_META[category].tone}
                            selected={activeMember.keys.includes(d.key)}
                            onPress={() => toggleKey(activeMember.id, d.key)}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {step === 'review' && (
            <View style={{ gap: Spacing.four }}>
              <View style={{ gap: Spacing.one }}>
                <Eyebrow>Almost there</Eyebrow>
                <Heading>{householdName.trim() || 'Our household'}</Heading>
                <Body color={palette.textSecondary}>
                  {REGIONS[region].label}
                  {' · '}
                  {members.length} {members.length === 1 ? 'person' : 'people'}
                </Body>
              </View>
              {members.map((m) => (
                <View key={m.id} style={[styles.reviewCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
                  <Body style={{ fontFamily: Type.bodySemibold }}>{m.name}</Body>
                  <Small>
                    {m.keys.length
                      ? m.keys.map((k) => k.replace(/_/g, ' ')).join(' · ')
                      : 'No restrictions'}
                  </Small>
                </View>
              ))}
            </View>
          )}
        </Reveal>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={step === 'review' ? 'Generate our plan' : 'Continue'}
          onPress={onNext}
          disabled={!canContinue}
        />
      </View>
    </Screen>
  );
}

/* ---------- local building blocks ---------- */

function Field(props: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}) {
  const palette = usePalette();
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={palette.textSecondary}
      autoFocus={props.autoFocus}
      onSubmitEditing={props.onSubmitEditing}
      returnKeyType="done"
      style={[styles.field, { color: palette.text, backgroundColor: palette.card, borderColor: palette.border }]}
    />
  );
}

function Segmented(props: {
  options: { value: AgeBand; label: string }[];
  value: AgeBand;
  onChange: (v: AgeBand) => void;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: palette.backgroundElement }]}>
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <PressableScale key={o.value} onPress={() => props.onChange(o.value)} to={0.96} style={{ flex: 1 }}>
            <View style={[styles.segment, active && { backgroundColor: palette.card }]}>
              <Text
                style={{
                  fontFamily: active ? Type.bodySemibold : Type.bodyMedium,
                  fontSize: 14,
                  color: active ? palette.accent : palette.textSecondary,
                }}
              >
                {o.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function MemberRow({ member, onRemove }: { member: DraftMember; onRemove: () => void }) {
  const palette = usePalette();
  return (
    <View style={[styles.memberRow, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <View style={[styles.avatarSm, { backgroundColor: palette.accentMuted }]}>
        <Text style={{ fontFamily: Type.display, fontSize: 16, color: palette.accent }}>
          {(member.name.trim()[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Body style={{ fontFamily: Type.bodySemibold }}>{member.name}</Body>
        <Small>{member.ageBand}</Small>
      </View>
      <PressableScale onPress={onRemove} to={0.9}>
        <Text style={{ fontFamily: Type.bodySemibold, fontSize: 13, color: palette.textSecondary }}>Remove</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  back: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  field: {
    fontFamily: Type.body,
    fontSize: 16,
    height: 52,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 52,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, gap: 4 },
  segment: { height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatars: { gap: Spacing.three, paddingVertical: Spacing.one, paddingRight: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatarSm: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  reviewCard: { gap: 4, padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
  footer: { paddingVertical: Spacing.three },
});
