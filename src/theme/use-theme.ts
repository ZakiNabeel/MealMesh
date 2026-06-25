import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { THEMES, type Palette, type ThemeName } from '@/constants/theme';

const STORAGE_KEY = 'mealmesh.theme';

type ThemeState = {
  themeName: ThemeName;
  palette: Palette;
  setTheme: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('garden');

  // Restore the saved theme on launch.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in THEMES) setThemeName(saved as ThemeName);
      })
      .catch(() => {});
  }, []);

  // Keep the web page background in sync so screen edges never flash the wrong colour.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = THEMES[themeName].background;
    }
  }, [themeName]);

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  };

  const value = useMemo<ThemeState>(
    () => ({ themeName, palette: THEMES[themeName], setTheme }),
    [themeName],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

/** The active colour palette. Falls back to Garden before the provider mounts. */
export function usePalette(): Palette {
  return useContext(ThemeContext)?.palette ?? THEMES.garden;
}

/** Read + switch the active theme (used by the Settings switcher). */
export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

export type { Palette };

/** True when the user has asked the OS to minimise motion. */
export function useReduced(): boolean {
  return useReducedMotion();
}
