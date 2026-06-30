/**
 * BrandIntro — the slick launch animation shown once when the app cold-starts.
 *
 * It tells the brand story in ~2.2s: two diet "threads" (green + blue) sweep in
 * from opposite edges and weave across each other, a bright knot pops at their
 * crossing ("many diets → one plan"), then the wordmark and tagline rise. The
 * whole thing fades out and calls `onFinish`, handing off to the real app.
 *
 * The full-bleed blue→green gradient matches the native OS splash color, so the
 * transition from the system splash into this animation is seamless (no flash).
 * Under reduced-motion it degrades to a quick, calm fade. It renders ABOVE the
 * app and unmounts itself, so it costs nothing after the first play.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { Threads, Type } from '@/constants/theme';
import { useReduced } from '@/theme/use-theme';

const KNOT = 92;
const THREAD_W = 300;
const THREAD_H = 34;

export function BrandIntro({ onFinish }: { onFinish: () => void }) {
  const { width } = useWindowDimensions();
  const reduce = useReduced();

  // One driver per element so the sequence reads clearly.
  const greenX = useSharedValue(-(width / 2 + THREAD_W));
  const blueX = useSharedValue(width / 2 + THREAD_W);
  const knot = useSharedValue(0);
  const knotPulse = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    const ease: WithTimingConfig = { duration: 640, easing: Easing.out(Easing.cubic) };

    // The gate (when the app is revealed) is driven by a plain JS timer, NOT the
    // animation's completion callback — so the splash ALWAYS dismisses on time,
    // even if the worklet/animation engine misbehaves on a given platform. The
    // reanimated values below are purely the visual layer on top.
    let total: number;
    if (reduce) {
      greenX.value = 0;
      blueX.value = 0;
      knot.value = withTiming(1, { duration: 400 });
      word.value = withTiming(1, { duration: 500 });
      tag.value = withDelay(200, withTiming(1, { duration: 500 }));
      fade.value = withDelay(1600, withTiming(0, { duration: 450 }));
      total = 2050;
    } else {
      // 1) threads sweep in and cross
      greenX.value = withDelay(120, withTiming(0, ease));
      blueX.value = withDelay(120, withTiming(0, ease));
      // 2) knot pops at the crossing, then a soft pulse
      knot.value = withDelay(620, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(2)) }));
      knotPulse.value = withDelay(1040, withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 520 })));
      // 3) wordmark + tagline rise
      word.value = withDelay(980, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
      tag.value = withDelay(1280, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
      // 4) hold, then fade out
      fade.value = withDelay(2050, withTiming(0, { duration: 480 }));
      total = 2530;
    }

    const t = setTimeout(onFinish, total);
    return () => clearTimeout(t);
  }, [reduce, width, greenX, blueX, knot, knotPulse, word, tag, fade, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const greenStyle = useAnimatedStyle(() => ({ transform: [{ rotate: '24deg' }, { translateX: greenX.value }] }));
  const blueStyle = useAnimatedStyle(() => ({ transform: [{ rotate: '-24deg' }, { translateX: blueX.value }] }));
  const knotStyle = useAnimatedStyle(() => ({
    opacity: knot.value,
    transform: [{ scale: knot.value * (1 + knotPulse.value * 0.12) }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 16 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value * 0.92,
    transform: [{ translateY: (1 - tag.value) * 10 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, containerStyle]} pointerEvents="none">
      <LinearGradient
        colors={['#208AEF', '#1C9FC9', Threads.green]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.stage}>
        {/* green thread (under) */}
        <Animated.View style={[styles.thread, greenStyle]}>
          <LinearGradient colors={['#19A87C', Threads.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* blue thread (over) */}
        <Animated.View style={[styles.thread, blueStyle]}>
          <LinearGradient colors={['#2E8FD6', '#7FD0F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* short green segment laid back over blue near the crossing — the weave */}
        <Animated.View style={[styles.weave, greenStyle]}>
          <LinearGradient colors={['#19A87C', Threads.green]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* the knot — one plan */}
        <Animated.View style={[styles.knot, knotStyle]}>
          <View style={styles.knotCore} />
        </Animated.View>
      </View>

      <Animated.Text style={[styles.word, wordStyle]}>MealMesh</Animated.Text>
      <Animated.Text style={[styles.tag, tagStyle]}>One household. Many diets. One plan.</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  stage: { width: KNOT * 2.2, height: KNOT * 2.2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thread: { position: 'absolute', width: THREAD_W, height: THREAD_H, borderRadius: THREAD_H, overflow: 'hidden' },
  weave: { position: 'absolute', width: THREAD_H * 1.6, height: THREAD_H, borderRadius: THREAD_H, left: KNOT * 0.34, top: KNOT * 1.1 - THREAD_H / 2, overflow: 'hidden' },
  knot: {
    width: KNOT,
    height: KNOT,
    borderRadius: KNOT,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A3D62',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  knotCore: { width: '40%', height: '40%', borderRadius: 999, backgroundColor: Threads.green },
  word: { marginTop: 36, color: '#FFFFFF', fontFamily: Type.displayBold, fontSize: 40, letterSpacing: 0.3 },
  tag: { marginTop: 10, color: 'rgba(255,255,255,0.92)', fontFamily: Type.bodyMedium, fontSize: 14.5, letterSpacing: 0.2 },
});
