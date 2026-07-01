/**
 * BrandIntro — the launch animation shown once when the app cold-starts.
 *
 * ~5s branded sequence on the logo's garden-green gradient (matching the native
 * OS splash color, so the handoff from the system splash is seamless): the MealMesh logo
 * scales in with a soft glow, then the wordmark and tagline rise, hold, and fade
 * out — handing off to the real app.
 *
 * The app-reveal is driven by a plain JS timer, NOT the animation's completion
 * callback, so the splash can never get stuck covering the app if the animation
 * engine misbehaves on a platform. Under reduced-motion it degrades to a calm
 * fade. It renders ABOVE the app and unmounts itself, so it costs nothing after
 * the first play.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Type } from '@/constants/theme';
import { useReduced } from '@/theme/use-theme';

const LOGO = require('../../assets/images/icon.png');
const TAGLINE = 'Different Diets. One Dinner';
const LOGO_SIZE = 132;

export function BrandIntro({ onFinish }: { onFinish: () => void }) {
  const reduce = useReduced();

  const logo = useSharedValue(0);
  const glow = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    // The gate (when the app is revealed) is a plain JS timer, independent of
    // the animation engine, so the splash ALWAYS dismisses on time.
    let total: number;
    if (reduce) {
      logo.value = withTiming(1, { duration: 500 });
      word.value = withDelay(300, withTiming(1, { duration: 500 }));
      tag.value = withDelay(600, withTiming(1, { duration: 500 }));
      fade.value = withDelay(3800, withTiming(0, { duration: 600 }));
      total = 4600;
    } else {
      // 1) logo scales in with a gentle overshoot + soft glow behind it
      logo.value = withDelay(200, withTiming(1, { duration: 720, easing: Easing.out(Easing.back(1.7)) }));
      glow.value = withDelay(
        300,
        withSequence(withTiming(1, { duration: 900 }), withTiming(0.55, { duration: 1400 })),
      );
      // 2) wordmark + tagline rise
      word.value = withDelay(1050, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
      tag.value = withDelay(1450, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
      // 3) hold, then fade out and hand off to the app (~5s total)
      fade.value = withDelay(4300, withTiming(0, { duration: 560 }));
      total = 4900;
    }

    const t = setTimeout(onFinish, total);
    return () => clearTimeout(t);
  }, [reduce, logo, glow, word, tag, fade, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: 0.7 + logo.value * 0.3 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.55, transform: [{ scale: 1 + glow.value * 0.25 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 16 }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value * 0.95, transform: [{ translateY: (1 - tag.value) * 10 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, containerStyle]} pointerEvents="none">
      <LinearGradient
        colors={['#7FAE85', '#9FC1A4', '#B7D4BB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.logoWrap}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={logoStyle}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.Text style={[styles.word, wordStyle]}>MealMesh</Animated.Text>
      <Animated.Text style={[styles.tag, tagStyle]}>{TAGLINE}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: LOGO_SIZE * 1.6,
    height: LOGO_SIZE * 1.6,
    borderRadius: LOGO_SIZE,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.24,
    shadowColor: '#062B22',
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  word: { marginTop: 40, color: '#FFFFFF', fontFamily: Type.displayBold, fontSize: 42, letterSpacing: 0.3 },
  tag: { marginTop: 12, color: 'rgba(255,255,255,0.95)', fontFamily: Type.bodyMedium, fontSize: 15.5, letterSpacing: 0.3 },
});
