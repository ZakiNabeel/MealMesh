import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

/** The active colour palette for the current light/dark scheme. */
export function usePalette() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export type Palette = ReturnType<typeof usePalette>;

/** True when the user has asked the OS to minimise motion. */
export function useReduced(): boolean {
  return useReducedMotion();
}
