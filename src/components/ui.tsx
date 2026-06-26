/**
 * MealMesh UI kit — the small, opinionated set of primitives every screen is
 * built from. Brand type (Fraunces × Space Grotesk), the atmospheric ground,
 * glass surfaces, tactile press, and staggered entrances all live here so the
 * screens stay thin and consistent.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodMarquee } from '@/components/FoodMarquee';
import { DesktopWidth, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { usePalette, useReduced } from '@/theme/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ------------------------------------------------------------------ */
/* Atmosphere                                                          */
/* ------------------------------------------------------------------ */

/** Soft gradient-mesh ground: a calm wash plus two diffuse colour blobs. */
export function Atmosphere() {
  const palette = usePalette();
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <LinearGradient colors={[palette.atmosphereTop, palette.atmosphereBottom]} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.blob,
          { top: -120, left: -80, backgroundColor: palette.blobA, opacity: 0.16 },
        ]}
      />
      <View
        style={[
          styles.blob,
          { bottom: -140, right: -100, backgroundColor: palette.blobB, opacity: 0.14 },
        ]}
      />
    </View>
  );
}

/** Full-screen container: atmosphere + an optional clipart watermark + safe area. */
export function Screen({
  children,
  art,
  style,
}: {
  children: ReactNode;
  art?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DesktopWidth;
  return (
    <View style={{ flex: 1, backgroundColor: palette.background, overflow: 'hidden' }}>
      <Atmosphere />
      {art && !isDesktop && (
        <View style={styles.art} pointerEvents="none">
          <Image
            source={art}
            resizeMode="contain"
            style={[StyleSheet.absoluteFill, { opacity: palette.glassTint === 'dark' ? 0.12 : 0.07 }]}
          />
        </View>
      )}
      <SafeAreaView style={{ flex: 1 }}>
        {isDesktop ? (
          <View style={styles.desktopRow}>
            <View style={styles.desktopContent}>
              <View style={[styles.column, style]}>{children}</View>
            </View>
            <View style={[styles.desktopRail, { borderLeftColor: palette.border }]}>
              <FoodMarquee />
            </View>
          </View>
        ) : (
          <View style={[styles.column, style]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Frosted-glass surface for elevated cards. Falls back to a tinted fill. */
export function GlassCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const dark = palette.glassTint === 'dark';
  return (
    <BlurView
      intensity={dark ? 24 : 40}
      tint={dark ? 'dark' : 'light'}
      style={[
        styles.glass,
        { borderColor: palette.border, backgroundColor: palette.card + (dark ? 'CC' : 'B3') },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/** Staggered entrance: fade + rise. Give siblings increasing `delay`. */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduced();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!reduce) {
      p.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    }
  }, [delay, p, reduce]);

  const animated = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * y }],
  }));

  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

/** Tactile press: a soft spring scale-down. Wraps any tappable surface. */
export function PressableScale({
  children,
  onPress,
  disabled,
  style,
  to = 0.96,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  to?: number;
}) {
  const reduce = useReduced();
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const spring = { damping: 18, stiffness: 240 };
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!reduce) s.value = withSpring(to, spring);
      }}
      onPressOut={() => {
        s.value = withSpring(1, spring);
      }}
      style={[animated, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

type TextProps = {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

function makeText(family: string, size: number, lineHeight: number, defaultColorKey: 'text' | 'textSecondary') {
  return function AppText({ children, color, style, numberOfLines }: TextProps) {
    const palette = usePalette();
    return (
      <Text
        numberOfLines={numberOfLines}
        style={[{ fontFamily: family, fontSize: size, lineHeight, color: color ?? palette[defaultColorKey] }, style]}
      >
        {children}
      </Text>
    );
  };
}

/** Big Fraunces hero heading. */
export const Display = makeText(Type.displayBold, 32, 37, 'text');
/** Section heading, Fraunces. */
export const Heading = makeText(Type.display, 24, 30, 'text');
/** Body copy, Space Grotesk. */
export const Body = makeText(Type.body, 16, 24, 'text');
/** Larger, softer intro copy. */
export const Lead = makeText(Type.body, 17, 26, 'textSecondary');
/** Small print. */
export const Small = makeText(Type.body, 13, 18, 'textSecondary');

/** Uppercase tracked eyebrow label. */
export function Eyebrow({ children, color, style }: TextProps) {
  const palette = usePalette();
  return (
    <Text
      style={[
        { fontFamily: Type.bodySemibold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: color ?? palette.accent },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const primary = variant === 'primary';
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={[{ width: '100%' }, style]}>
      <View
        style={[
          styles.button,
          primary
            ? { backgroundColor: palette.accent, shadowColor: palette.accent }
            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: palette.border },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text
          style={{
            fontFamily: Type.bodySemibold,
            fontSize: 16,
            color: primary ? palette.onAccent : palette.text,
          }}
        >
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Selectable pill. `tone` tints the active state to a brand "thread". */
export function Chip({
  label,
  selected,
  onPress,
  tone = 'green',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'green' | 'blue';
}) {
  const palette = usePalette();
  const active = tone === 'blue' ? palette.blue : palette.accent;
  const activeBg = tone === 'blue' ? palette.blueMuted : palette.accentMuted;
  return (
    <PressableScale onPress={onPress} to={0.94}>
      <View
        style={[
          styles.chip,
          selected
            ? { backgroundColor: activeBg, borderColor: active }
            : { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {selected && <View style={[styles.chipDot, { backgroundColor: active }]} />}
        <Text
          style={{
            fontFamily: selected ? Type.bodySemibold : Type.bodyMedium,
            fontSize: 14,
            color: selected ? active : palette.text,
          }}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Slim progress track with a green→blue "weave" fill. */
export function ProgressBar({ value }: { value: number }) {
  const palette = usePalette();
  const reduce = useReduced();
  const p = useSharedValue(reduce ? value : 0);
  useEffect(() => {
    p.value = reduce ? value : withTiming(value, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [value, p, reduce]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, p.value)) * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: palette.backgroundElement }]}>
      <Animated.View style={[styles.fill, fill]}>
        <LinearGradient
          colors={[palette.accent, palette.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  desktopRow: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1, minWidth: 0 },
  desktopRail: {
    width: '42%',
    maxWidth: 620,
    minWidth: 360,
    borderLeftWidth: 1,
  },
  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 320,
  },
  art: {
    position: 'absolute',
    right: -36,
    bottom: 64,
    width: 300,
    height: 300,
  },
  glass: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: Spacing.four,
  },
  button: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  chipDot: { width: 8, height: 8, borderRadius: 8 },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: Radius.pill, overflow: 'hidden' },
});
