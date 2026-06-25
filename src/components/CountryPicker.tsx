/**
 * A searchable country picker: a tappable field that opens a slide-up sheet
 * with a live search box and the full country list. Selecting a country returns
 * its ISO code. Styled with the brand light palette + glass sheet.
 */

import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { COUNTRIES, countryByCode, flagEmoji } from '@/lib/geo';
import { CURRENCY } from '@/lib/countries';
import { usePalette } from '@/theme/use-theme';

export function CountryPicker({
  value,
  onSelect,
  placeholder = 'Select your country',
}: {
  value?: string;
  onSelect: (code: string) => void;
  placeholder?: string;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = value ? countryByCode(value) : null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    );
  }, [query]);

  return (
    <>
      <PressableScale onPress={() => setOpen(true)} to={0.98}>
        <View style={[styles.field, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {selected ? (
            <>
              <Text style={{ fontSize: 22 }}>{flagEmoji(selected.code)}</Text>
              <Text style={{ flex: 1, fontFamily: Type.bodyMedium, fontSize: 16, color: palette.text }}>
                {selected.label}
              </Text>
              <Small color={palette.textSecondary}>{selected.currency}</Small>
            </>
          ) : (
            <Text style={{ flex: 1, fontFamily: Type.body, fontSize: 16, color: palette.textSecondary }}>
              {placeholder}
            </Text>
          )}
          <Text style={{ fontSize: 14, color: palette.textSecondary }}>▾</Text>
        </View>
      </PressableScale>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={styles.grabber} />
          <View style={{ padding: Spacing.three, gap: Spacing.two }}>
            <Text style={{ fontFamily: Type.display, fontSize: 20, color: palette.text }}>Where do you shop?</Text>
            <View style={[styles.search, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
              <Text style={{ fontSize: 15, color: palette.textSecondary }}>⌕</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search 100+ countries…"
                placeholderTextColor={palette.textSecondary}
                autoFocus
                autoCorrect={false}
                style={{ flex: 1, fontFamily: Type.body, fontSize: 16, color: palette.text }}
              />
            </View>
          </View>
          <FlatList
            data={results}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.six }}
            renderItem={({ item }) => {
              const active = item.code === value;
              return (
                <PressableScale
                  onPress={() => {
                    onSelect(item.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  to={0.98}
                >
                  <View
                    style={[
                      styles.row,
                      { borderColor: palette.border },
                      active && { backgroundColor: palette.accentMuted, borderColor: palette.accent },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{flagEmoji(item.code)}</Text>
                    <Text style={{ flex: 1, fontFamily: Type.bodyMedium, fontSize: 16, color: palette.text }}>
                      {item.label}
                    </Text>
                    <Small color={active ? palette.accent : palette.textSecondary}>
                      {CURRENCY[item.currency]?.symbol ?? ''} {item.currency}
                    </Small>
                  </View>
                </PressableScale>
              );
            }}
            ListEmptyComponent={
              <Small color={palette.textSecondary} style={{ textAlign: 'center', marginTop: Spacing.four }}>
                No match — try the country&apos;s English name.
              </Small>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 52,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '12%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: 'rgba(127,127,127,0.4)', marginTop: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 46,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.two,
  },
});
