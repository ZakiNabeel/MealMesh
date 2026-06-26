/**
 * ThemeSwitcher — a compact, always-visible way to flip between the three
 * themes (Garden / Graphite / Maroon) right from the home page. Each dot shows
 * a theme's surface + accent; the active one gets an accent ring.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { THEME_META } from '@/constants/theme';
import { usePalette, useTheme } from '@/theme/use-theme';

export function ThemeSwitcher({ size = 28 }: { size?: number }) {
  const { themeName, setTheme } = useTheme();
  const palette = usePalette();
  return (
    <View style={styles.row}>
      {THEME_META.map((t) => {
        const active = themeName === t.name;
        return (
          <Pressable
            key={t.name}
            onPress={() => setTheme(t.name)}
            accessibilityLabel={`${t.label} theme`}
            style={(s) => [
              styles.dot,
              {
                width: size,
                height: size,
                borderRadius: size,
                backgroundColor: t.swatch[0],
                borderColor: active ? palette.accent : palette.border,
                borderWidth: active ? 2 : 1,
                opacity: (s as { hovered?: boolean }).hovered || active ? 1 : 0.8,
              },
            ]}
          >
            <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, backgroundColor: t.swatch[1] }} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { alignItems: 'center', justifyContent: 'center' },
});
