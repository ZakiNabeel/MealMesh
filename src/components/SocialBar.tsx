/**
 * SocialBar + BrandLockup — website chrome for the desktop landing page.
 *
 * Social glyphs are tiny inline SVGs rendered as data-URI Images so we don't
 * pull in an icon font. Each glyph is drawn in a single colour that we pass in,
 * so it stays legible on every theme (dark glyph on light, light on dark).
 */

import { Image, Linking, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';

import { Type } from '@/constants/theme';
import type { Palette } from '@/constants/theme';

const LOGO = require('../../assets/logo.svg');

/** Each entry draws a recognisable monochrome glyph in the given colour. */
const GLYPHS: { key: string; label: string; url: string; svg: (c: string) => string }[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    url: 'https://instagram.com/mealmesh',
    svg: (c) =>
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='5'/><circle cx='12' cy='12' r='4'/><circle cx='17.4' cy='6.6' r='1.1' fill='${c}' stroke='none'/></svg>`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    url: 'https://facebook.com/mealmesh',
    svg: (c) =>
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${c}'><path d='M13.4 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.4 1.4-1.4h1.4V5.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2H8v2.8h2.3V21h3.1z'/></svg>`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    url: 'https://linkedin.com/company/mealmesh',
    svg: (c) =>
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${c}'><path d='M6.94 7.4a1.94 1.94 0 110-3.88 1.94 1.94 0 010 3.88zM5.4 8.9h3.1v9.6H5.4V8.9zm5 0h2.97v1.3h.04c.41-.78 1.42-1.6 2.93-1.6 3.13 0 3.71 2.06 3.71 4.74v5.16h-3.1V14c0-1.07-.02-2.45-1.49-2.45-1.5 0-1.72 1.17-1.72 2.37v4.58h-3.1V8.9z'/></svg>`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    url: 'https://youtube.com/@mealmesh',
    svg: (c) =>
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='2'><rect x='2.5' y='6' width='19' height='12' rx='3.5'/><path d='M10.6 9.3l5 2.7-5 2.7z' fill='${c}' stroke='none'/></svg>`,
  },
  {
    key: 'pinterest',
    label: 'Pinterest',
    url: 'https://pinterest.com/mealmesh',
    svg: (c) =>
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${c}'><path d='M12 3a9 9 0 00-3.3 17.3c-.1-.7-.2-1.8 0-2.6l1-4.4s-.3-.5-.3-1.3c0-1.3.7-2.2 1.6-2.2.8 0 1.1.6 1.1 1.3 0 .8-.5 2-.8 3.1-.2.9.5 1.6 1.4 1.6 1.7 0 2.9-2.2 2.9-4.7 0-1.9-1.3-3.4-3.7-3.4a4.2 4.2 0 00-4.4 4.2c0 .8.3 1.4.7 1.8.1.1.1.2.1.3l-.2.8c0 .2-.2.3-.4.2-1.1-.5-1.6-1.8-1.6-3 0-2.4 1.8-4.8 5.5-4.8 2.9 0 4.8 2 4.8 4.3 0 3-1.6 5.2-4.1 5.2-.8 0-1.6-.4-1.9-.9l-.5 1.9c-.2.6-.5 1.3-.8 1.8A9 9 0 1012 3z'/></svg>`,
  },
  {
    key: 'x',
    label: 'X',
    url: 'https://x.com/mealmesh',
    svg: (c) =>
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${c}'><path d='M17.5 3h2.9l-6.3 7.2L21.5 21h-5.8l-4.5-5.9L5.9 21H3l6.7-7.7L2.8 3h5.9l4.1 5.4L17.5 3zm-1 16.2h1.6L8 4.7H6.3l10.2 14.5z'/></svg>`,
  },
];

function dataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Row of circular social buttons. */
export function SocialBar({ palette, size = 40 }: { palette: Palette; size?: number }) {
  const glyph = palette.background; // contrasts against the dark circle
  return (
    <View style={styles.row}>
      {GLYPHS.map((g) => (
        <Pressable
          key={g.key}
          accessibilityLabel={g.label}
          onPress={() => Linking.openURL(g.url)}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.btn,
            { width: size, height: size, borderRadius: size, backgroundColor: palette.text, opacity: hovered ? 0.82 : 1 },
          ]}
        >
          <Image source={{ uri: dataUri(g.svg(glyph)) }} style={{ width: size * 0.5, height: size * 0.5 }} />
        </Pressable>
      ))}
    </View>
  );
}

/** Logo glyph + wordmark, used in the website nav and footer. */
export function BrandLockup({
  palette,
  size = 34,
  color,
  style,
}: {
  palette: Palette;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <View style={styles.lockup}>
      <Image source={LOGO} style={[{ width: size, height: size, borderRadius: size * 0.28 }, style]} />
      <Text style={{ fontFamily: Type.displayBold, fontSize: size * 0.62, color: color ?? palette.text, letterSpacing: 0.2 }}>
        MealMesh
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  btn: { alignItems: 'center', justifyContent: 'center' },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
