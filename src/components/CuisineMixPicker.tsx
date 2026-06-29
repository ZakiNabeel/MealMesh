/**
 * Lets a household blend more than one cuisine (e.g. 80% Pakistani-style
 * south_asian + 20% Chinese) instead of being locked to a single region.
 * Tap a chip to add/remove it from the mix (up to 3); when 2+ are selected,
 * a +/-10 stepper appears so the user can rebalance the split. The last
 * remaining slider always keeps the total at exactly 100 — incrementing one
 * cuisine takes 10 from whichever other cuisine currently has the most.
 */

import { Text, View } from 'react-native';

import { Chip, PressableScale, Small } from '@/components/ui';
import { Spacing, Type } from '@/constants/theme';
import { REGIONS } from '@/lib/dietLibrary';
import { usePalette } from '@/theme/use-theme';
import type { CuisineWeight, Region } from '@/types';

const MAX_CUISINES = 3;
const STEP = 10;
const MIN_PERCENT = 10;

export function CuisineMixPicker({
  value,
  onChange,
}: {
  /** Current mix; always at least one entry summing to 100. */
  value: CuisineWeight[];
  onChange: (next: CuisineWeight[]) => void;
}) {
  const palette = usePalette();
  const selectedRegions = new Set(value.map((c) => c.region));

  function toggle(region: Region) {
    if (selectedRegions.has(region)) {
      if (value.length === 1) return; // must keep at least one
      const removed = value.find((c) => c.region === region)!;
      const rest = value.filter((c) => c.region !== region);
      // Redistribute the removed slice onto the largest remaining entry.
      const biggest = rest.reduce((a, b) => (b.percent > a.percent ? b : a));
      onChange(rest.map((c) => (c === biggest ? { ...c, percent: c.percent + removed.percent } : c)));
      return;
    }
    if (value.length >= MAX_CUISINES) return;
    // New entry takes a fixed 20% from whichever existing entry has the most.
    const take = Math.min(20, value.reduce((a, b) => (b.percent > a.percent ? b : a)).percent - MIN_PERCENT);
    if (take <= 0) return;
    const biggest = value.reduce((a, b) => (b.percent > a.percent ? b : a));
    const next = value.map((c) => (c === biggest ? { ...c, percent: c.percent - take } : c));
    onChange([...next, { region, percent: take }]);
  }

  function adjust(region: Region, delta: number) {
    if (value.length < 2) return;
    const target = value.find((c) => c.region === region);
    if (!target) return;
    if (delta > 0) {
      // Take STEP from whichever other entry currently has the most room.
      const donors = value.filter((c) => c.region !== region && c.percent - STEP >= MIN_PERCENT);
      if (!donors.length) return;
      const donor = donors.reduce((a, b) => (b.percent > a.percent ? b : a));
      onChange(
        value.map((c) =>
          c.region === region ? { ...c, percent: c.percent + STEP } : c.region === donor.region ? { ...c, percent: c.percent - STEP } : c,
        ),
      );
    } else {
      if (target.percent - STEP < MIN_PERCENT) return;
      // Give STEP back to whichever other entry currently has the least.
      const others = value.filter((c) => c.region !== region);
      const recipient = others.reduce((a, b) => (b.percent < a.percent ? b : a));
      onChange(
        value.map((c) =>
          c.region === region ? { ...c, percent: c.percent - STEP } : c.region === recipient.region ? { ...c, percent: c.percent + STEP } : c,
        ),
      );
    }
  }

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {Object.values(REGIONS).map((r) => (
          <Chip key={r.region} label={r.label} selected={selectedRegions.has(r.region)} onPress={() => toggle(r.region)} />
        ))}
      </View>
      {value.length >= 2 && (
        <View style={{ gap: Spacing.two }}>
          <Small color={palette.textSecondary}>Mix the split — tap +/- to rebalance.</Small>
          {value.map((c) => (
            <View
              key={c.region}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.two,
                paddingVertical: 6,
                paddingHorizontal: Spacing.three,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.card,
              }}
            >
              <Text style={{ flex: 1, fontFamily: Type.bodyMedium, fontSize: 14, color: palette.text }}>
                {REGIONS[c.region].label}
              </Text>
              <Stepper onPress={() => adjust(c.region, -STEP)} label="–" disabled={value.length < 2} />
              <Text style={{ fontFamily: Type.bodySemibold, fontSize: 14, color: palette.accent, minWidth: 38, textAlign: 'center' }}>
                {c.percent}%
              </Text>
              <Stepper onPress={() => adjust(c.region, STEP)} label="+" disabled={value.length < 2} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Stepper({ onPress, label, disabled }: { onPress: () => void; label: string; disabled?: boolean }) {
  const palette = usePalette();
  return (
    <PressableScale onPress={disabled ? () => {} : onPress} to={0.9}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.backgroundElement,
        }}
      >
        <Text style={{ fontFamily: Type.bodySemibold, fontSize: 16, color: palette.text }}>{label}</Text>
      </View>
    </PressableScale>
  );
}
