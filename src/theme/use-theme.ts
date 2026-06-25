import { useReducedMotion } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

/**
 * The active colour palette. MealMesh is intentionally a single, consistent
 * light mint-green/blue brand — we do NOT follow the OS dark theme, so this
 * always returns the light palette regardless of the device setting.
 */
export function usePalette() {
  return Colors.light;
}

export type Palette = ReturnType<typeof usePalette>;

/** True when the user has asked the OS to minimise motion. */
export function useReduced(): boolean {
  return useReducedMotion();
}
