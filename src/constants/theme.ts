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

export const Colors = {
  light: {
    text: '#0B2B26', // deep pine (near-black green)
    textSecondary: '#5B7771', // sage grey
    background: '#F1FAF5', // mint white ground
    backgroundElement: '#E7F5EE', // soft mint fill
    backgroundSelected: '#D4EFE1',
    card: '#FFFFFF',
    border: '#DBEDE4',
    accent: '#0E9F6E', // garden green (primary)
    accentMuted: '#DCF4EA', // mint tint
    onAccent: '#FFFFFF',
    blue: '#2596CE', // calm blue (secondary thread)
    blueMuted: '#E1F1FA',
    success: '#15A06B',
    danger: '#E1483C',
    warning: '#E0921E',
  },
  dark: {
    text: '#EAF7F1',
    textSecondary: '#9CB7AE',
    background: '#06140F', // deep pine black
    backgroundElement: '#0E211B',
    backgroundSelected: '#173329',
    card: '#0E211B',
    border: '#1C3A31',
    accent: '#34D39E', // lifts on dark
    accentMuted: '#0F271F',
    onAccent: '#04130D',
    blue: '#5BB6E8',
    blueMuted: '#0E2530',
    success: '#34D39E',
    danger: '#F4796E',
    warning: '#F2B24C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
