/**
 * MealMesh does not support dark mode. Always returns 'light' so no component
 * ever picks up the OS dark-mode setting on web, regardless of the device or
 * browser preference. The hydration guard is no longer needed since we never
 * read a dynamic value.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
