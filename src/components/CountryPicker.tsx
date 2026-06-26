/**
 * A searchable country picker: a tappable field that opens a slide-up sheet
 * with a live search box and the full country list. Selecting a country returns
 * its ISO code. Styled with the brand light palette + glass sheet.
 */

import { useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Flag } from '@/components/Flag';
import { SheetModal } from '@/components/SheetModal';
import { PressableScale, Small } from '@/components/ui';
import { Radius, Spacing, Type } from '@/constants/theme';
import { COUNTRIES, countryByCode } from '@/lib/geo';
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

  // Explicit list height — RN-web won't give a flex:1 list a scroll viewport
  // inside a modal, so we size the scroll area directly (it scrolls with a
  // mouse wheel too).
  const listHeight = Math.min(540, Math.round(Dimensions.get('window').height * 0.62));

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
              <Flag code={selected.code} size={22} />
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

      <SheetModal visible={open} onClose={() => setOpen(false)} maxWidth={520}>
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
          <ScrollView
            style={{ height: listHeight }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.four }}
          >
            {results.length === 0 ? (
              <Small color={palette.textSecondary} style={{ textAlign: 'center', marginTop: Spacing.four }}>
                No match — try the country&apos;s English name.
              </Small>
            ) : (
              results.map((item) => {
                const active = item.code === value;
                return (
                  <PressableScale
                    key={item.code}
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
                      <Flag code={item.code} size={22} />
                      <Text style={{ flex: 1, fontFamily: Type.bodyMedium, fontSize: 16, color: palette.text }}>
                        {item.label}
                      </Text>
                      <Small color={active ? palette.accent : palette.textSecondary}>
                        {CURRENCY[item.currency]?.symbol ?? ''} {item.currency}
                      </Small>
                    </View>
                  </PressableScale>
                );
              })
            )}
          </ScrollView>
      </SheetModal>
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
