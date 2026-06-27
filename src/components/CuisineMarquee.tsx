/**
 * CuisineMarquee — the "Every kitchen" website strip as an endlessly looping
 * horizontal carousel of cuisine icons, mirroring FoodMarquee's drift pattern
 * (translateX instead of translateY). Falls back to the original static,
 * wrapped row when the user prefers reduced motion.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Type } from '@/constants/theme';
import { usePalette, useReduced } from '@/theme/use-theme';

export type Cuisine = { art: ImageSourcePropType; label: string };

const ITEM_W = 92;
const GAP = 28;
const PX_PER_SEC = 36; // unhurried drift, matches FoodMarquee's pace

function Item({ cuisine, palette }: { cuisine: Cuisine; palette: ReturnType<typeof usePalette> }) {
  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Image source={cuisine.art} alt="" resizeMode="contain" style={styles.img} />
      </View>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{cuisine.label}</Text>
    </View>
  );
}

export function CuisineMarquee({ cuisines }: { cuisines: Cuisine[] }) {
  const palette = usePalette();
  const reduce = useReduced();
  const setWidth = cuisines.length * (ITEM_W + GAP);
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduce || setWidth === 0) return;
    x.value = 0;
    x.value = withRepeat(withTiming(-setWidth, { duration: (setWidth / PX_PER_SEC) * 1000, easing: Easing.linear }), -1, false);
  }, [setWidth, reduce, x]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (reduce) {
    return (
      <View style={styles.staticRow}>
        {cuisines.map((c) => (
          <Item key={c.label} cuisine={c} palette={palette} />
        ))}
      </View>
    );
  }

  // Triple the set: the visible window only ever looks into the middle copy,
  // so the wraparound from -setWidth back to 0 is never visible as a jump.
  const tripled = [...cuisines, ...cuisines, ...cuisines];

  return (
    <View style={styles.clip}>
      <Animated.View style={[styles.track, { gap: GAP, paddingLeft: GAP }, animated]}>
        {tripled.map((c, i) => (
          <Item key={`${c.label}-${i}`} cuisine={c} palette={palette} />
        ))}
      </Animated.View>
      <LinearGradient
        colors={[palette.backgroundElement, palette.backgroundElement + '00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fade, { left: 0 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[palette.backgroundElement + '00', palette.backgroundElement]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fade, { right: 0 }]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', width: '100%' },
  track: { flexDirection: 'row' },
  staticRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GAP },
  item: { alignItems: 'center', gap: 10, width: ITEM_W },
  icon: { width: 76, height: 76, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  img: { width: 46, height: 46 },
  label: { fontFamily: Type.bodySemibold, fontSize: 13, textAlign: 'center' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 64 },
});
