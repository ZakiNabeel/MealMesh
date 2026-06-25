/**
 * MeshMark — the MealMesh signature.
 *
 * Two threads (a green diet, a blue diet) weave across each other and meet at a
 * single bright knot: many diets, one plan. It drifts gently on its own and
 * holds still under reduced-motion. Used large on the welcome hero and small as
 * a brand glyph elsewhere.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Threads } from '@/constants/theme';
import { usePalette, useReduced } from '@/theme/use-theme';

export function MeshMark({ size = 132 }: { size?: number }) {
  const palette = usePalette();
  const reduce = useReduced();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!reduce) {
      t.value = withRepeat(withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [reduce, t]);

  const ribbon = size * 1.7;
  const thickness = size * 0.2;

  const greenStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '26deg' }, { translateX: interpolate(t.value, [0, 1], [-5, 5]) }],
  }));
  const blueStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '-26deg' }, { translateX: interpolate(t.value, [0, 1], [5, -5]) }],
  }));
  const knotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [0, 1], [0.96, 1.04]) }],
  }));

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {/* green thread (under) */}
      <Animated.View
        style={[styles.ribbon, { width: ribbon, height: thickness, borderRadius: thickness }, greenStyle]}
      >
        <LinearGradient
          colors={[Threads.green, palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* blue thread (over) */}
      <Animated.View
        style={[styles.ribbon, { width: ribbon, height: thickness, borderRadius: thickness }, blueStyle]}
      >
        <LinearGradient
          colors={[Threads.blue, palette.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* the weave: a short green segment laid back over the blue near the crossing */}
      <Animated.View
        style={[
          styles.weavePatch,
          { width: thickness * 1.5, height: thickness, borderRadius: thickness, top: size * 0.5 - thickness / 2, left: size * 0.16 },
          greenStyle,
        ]}
      >
        <LinearGradient colors={[Threads.green, palette.accent]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* the knot — one plan */}
      <Animated.View
        style={[
          styles.knot,
          {
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.34,
            backgroundColor: palette.card,
            borderColor: palette.border,
            shadowColor: palette.accent,
          },
          knotStyle,
        ]}
      >
        <View style={[styles.knotCore, { backgroundColor: palette.accent }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: Radius.xl,
  },
  ribbon: { position: 'absolute', overflow: 'hidden' },
  weavePatch: { position: 'absolute', overflow: 'hidden' },
  knot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  knotCore: { width: '42%', height: '42%', borderRadius: 999 },
});
