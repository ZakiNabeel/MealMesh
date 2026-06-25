/**
 * MealMesh design tokens — "Woven" system.
 *
 * Direction: airy mint-white ground, a confident garden-green primary, and a
 * calm blue secondary — the two colours are the household's diet "threads"
 * that the brand weaves into one plan. Light, alive, food-forward; deliberately
 * NOT the dark acid-green look. Green dominates; blue is the second thread.
 *
 * Light and dark expose the SAME keys (ThemeColor is the intersection).
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * MealMesh ships THREE selectable themes (Settings → Appearance). The default
 * "Garden" light theme is the brand; users can switch to a dark "Graphite" or a
 * warm "Maroon" theme. Every theme exposes the SAME keys so screens are
 * theme-agnostic — they just read `usePalette()`. The last group of keys are
 * chrome hints (atmosphere wash, blob tints, status-bar + glass mode).
 */
export interface Palette {
  text: string;
  textSecondary: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  card: string;
  border: string;
  accent: string;
  accentMuted: string;
  onAccent: string;
  blue: string;
  blueMuted: string;
  success: string;
  danger: string;
  warning: string;
  // chrome
  atmosphereTop: string;
  atmosphereBottom: string;
  blobA: string;
  blobB: string;
  statusBar: 'light' | 'dark';
  glassTint: 'light' | 'dark';
}

export type ThemeName = 'garden' | 'graphite' | 'maroon';

const GARDEN: Palette = {
  text: '#0B2B26',
  textSecondary: '#5B7771',
  background: '#F1FAF5',
  backgroundElement: '#E7F5EE',
  backgroundSelected: '#D4EFE1',
  card: '#FFFFFF',
  border: '#DBEDE4',
  accent: '#0E9F6E',
  accentMuted: '#DCF4EA',
  onAccent: '#FFFFFF',
  blue: '#2596CE',
  blueMuted: '#E1F1FA',
  success: '#15A06B',
  danger: '#E1483C',
  warning: '#E0921E',
  atmosphereTop: '#EAF8F1',
  atmosphereBottom: '#EAF2FB',
  blobA: '#0E9F6E',
  blobB: '#2596CE',
  statusBar: 'dark',
  glassTint: 'light',
};

const GRAPHITE: Palette = {
  text: '#F2F3F5',
  textSecondary: '#9BA1AB',
  background: '#0E0F12',
  backgroundElement: '#191B1F',
  backgroundSelected: '#262A30',
  card: '#191B1F',
  border: '#2A2E35',
  accent: '#E8EAED', // near-white primary → clean monochrome buttons
  accentMuted: '#23262B',
  onAccent: '#15171B',
  blue: '#8B95A7', // slate secondary
  blueMuted: '#20242A',
  success: '#5BD0A0',
  danger: '#F4796E',
  warning: '#F2B24C',
  atmosphereTop: '#16181C',
  atmosphereBottom: '#0B0C0E',
  blobA: '#3A3F47',
  blobB: '#2A2E35',
  statusBar: 'light',
  glassTint: 'dark',
};

const MAROON: Palette = {
  text: '#3A1B1F',
  textSecondary: '#7A5C5E',
  background: '#FBF5EC', // cream
  backgroundElement: '#F3E9DA',
  backgroundSelected: '#EADBC8',
  card: '#FFFDF8',
  border: '#E7D9C6',
  accent: '#8C2F39', // maroon primary
  accentMuted: '#F1DDDC',
  onAccent: '#FFF7EC',
  blue: '#A9762F', // warm gold secondary thread
  blueMuted: '#F3E7CF',
  success: '#3E7D5A',
  danger: '#B23A2E',
  warning: '#B9822A',
  atmosphereTop: '#FBF1E2',
  atmosphereBottom: '#F6EAD8',
  blobA: '#8C2F39',
  blobB: '#A9762F',
  statusBar: 'dark',
  glassTint: 'light',
};

export const THEMES: Record<ThemeName, Palette> = {
  garden: GARDEN,
  graphite: GRAPHITE,
  maroon: MAROON,
};

/** For the Settings switcher: label + 3-colour preview swatch. */
export const THEME_META: { name: ThemeName; label: string; hint: string; swatch: [string, string, string] }[] = [
  { name: 'garden', label: 'Garden', hint: 'Fresh green & blue', swatch: ['#F1FAF5', '#0E9F6E', '#2596CE'] },
  { name: 'graphite', label: 'Graphite', hint: 'Black & grey', swatch: ['#191B1F', '#E8EAED', '#8B95A7'] },
  { name: 'maroon', label: 'Maroon', hint: 'Maroon & cream', swatch: ['#FBF5EC', '#8C2F39', '#A9762F'] },
];

/** Back-compat shim (a few legacy files import `Colors`). */
export const Colors = { light: GARDEN, dark: GRAPHITE };

export type ThemeColor = keyof Palette;

/** The two "threads" of the brand weave — used by the mesh motif + diet chips. */
export const Threads = {
  green: '#1FBF8F',
  blue: '#3AA0D9',
} as const;

/**
 * Brand type. Fraunces (warm serif) carries headings; Space Grotesk (grotesk)
 * carries everything functional. Loaded in src/app/_layout.tsx.
 */
export const Type = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  serif: 'Fraunces_400Regular',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemibold: 'SpaceGrotesk_600SemiBold',
  bodyBold: 'SpaceGrotesk_700Bold',
} as const;

/** Legacy template font map (kept so the starter components still compile). */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** 4pt spacing scale. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/** Mobile-first: constrain content so the web build reads like the app. */
export const MaxContentWidth = 480;
