/**
 * MealMesh does not support dark mode. Always returns 'light' so no component
 * ever picks up the OS dark-mode setting, regardless of the device preference.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
