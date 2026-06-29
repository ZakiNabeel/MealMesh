/**
 * FoodCarouselRail — a small auto-advancing food-photo card for the desktop
 * side rail on the Surprise Me screen. Purely decorative inspiration, themed
 * to whichever cuisine the user has selected. Uses the same `FoodImage`
 * Pexels-or-gradient-fallback path as every other dish thumbnail in the app,
 * so it never depends on a network call succeeding.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodImage } from '@/components/FoodImage';
import { Eyebrow, GlassCard, Small } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { Region } from '@/types';

const DISH_QUERIES: Record<Region, string[]> = {
  south_asian: ['chicken biryani', 'lentil daal', 'beef karahi', 'palak paneer'],
  middle_eastern: ['chicken shawarma', 'hummus plate', 'lamb kebab', 'falafel'],
  mediterranean: ['grilled fish', 'greek salad', 'olive oil pasta', 'roasted vegetables'],
  east_asian: ['ginger stir-fry', 'ramen bowl', 'sushi platter', 'teriyaki chicken'],
  chinese: ['kung pao chicken', 'fried rice', 'dim sum dumplings', 'wonton soup'],
  latin: ['street tacos', 'black bean bowl', 'ceviche', 'empanadas'],
  african: ['berbere stew', 'jollof rice', 'peanut stew', 'grilled tilapia'],
  american: ['bbq ribs', 'roast chicken dinner', 'mac and cheese', 'grilled steak'],
  european: ['braised beef', 'roasted vegetables', 'creamy soup', 'herb roasted chicken'],
  none: ['comfort food plate', 'roasted chicken dinner', 'vegetable stir-fry', 'fresh salad'],
};

export function FoodCarouselRail({ region }: { region: Region }) {
  const queries = DISH_QUERIES[region] ?? DISH_QUERIES.none;
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    const id = setInterval(() => setI((n) => (n + 1) % queries.length), 4000);
    return () => clearInterval(id);
  }, [region, queries.length]);

  const dish = queries[i % queries.length];

  return (
    <GlassCard style={{ gap: Spacing.three }}>
      <Eyebrow>Tonight&apos;s inspiration</Eyebrow>
      <View style={styles.frame}>
        <FoodImage name={dish} ingredients={[]} query={dish} style={styles.photo} emojiSize={40} />
      </View>
      <Small style={{ textAlign: 'center', textTransform: 'capitalize' }}>{dish}</Small>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: 180, borderRadius: Radius.md, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
});
