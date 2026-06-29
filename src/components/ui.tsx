/**
 * MealMesh UI kit — the small, opinionated set of primitives every screen is
 * built from. Brand type (Fraunces × Space Grotesk), the atmospheric ground,
 * glass surfaces, tactile press, and staggered entrances all live here so the
 * screens stay thin and consistent.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
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
import { DesktopContentWidth, DesktopWidth, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { usePalette, useReduced } from '@/theme/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** True on web viewports wide enough for the desktop / website layout. */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DesktopWidth;
}

/**
 * True when MealMesh is running as the actual app — native, or an installed PWA
 * (standalone display mode) — rather than a plain browser visit. We use this to
 * decide between the marketing website (browser) and the focused app (installed)
 * so the same code serves both without one bleeding into the other.
 */
export function useIsInstalledApp(): boolean {
  const [installed] = useState(() => {
    if (Platform.OS !== 'web') return true;
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
  });
  return installed;
}

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
  rail = false,
  wide = false,
  maxWidth,
  header,
}: {
  children: ReactNode;
  art?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  /** Show the desktop food-photo rail on the right. Only a couple of screens
   *  (onboarding, paywall) opt in — it shouldn't follow you around the app. */
  rail?: boolean;
  /** Use the roomier desktop content width (for grid/dashboard screens) so the
   *  page doesn't read as a thin phone-width strip floating in empty space. */
  wide?: boolean;
  /** Override the desktop content budget (default DesktopContentWidth) — for
   *  3-column rail layouts that need more room than a 2-column dashboard. */
  maxWidth?: number;
  /** Persistent chrome pinned above the (scrolling) content — e.g. AppHeader.
   *  Rendered as a sibling above the content column so it never scrolls away. */
  header?: ReactNode;
}) {
  const palette = usePalette();
  const isDesktop = useIsDesktop();
  const showRail = isDesktop && rail;
  const columnStyle =
    isDesktop && wide && !rail ? [styles.column, { maxWidth: maxWidth ?? DesktopContentWidth }] : styles.column;
  return (
    <View style={{ flex: 1, backgroundColor: palette.background, overflow: 'hidden' }}>
      <Atmosphere />
      {art && !showRail && (
        <View style={styles.art} pointerEvents="none">
          <Image
            source={art}
            resizeMode="contain"
            style={[StyleSheet.absoluteFill, { opacity: palette.glassTint === 'dark' ? 0.12 : 0.07 }]}
          />
        </View>
      )}
      <SafeAreaView style={{ flex: 1 }}>
        {header}
        {showRail ? (
          <View style={styles.desktopRow}>
            <View style={styles.desktopContent}>
              <View style={[styles.column, style]}>{children}</View>
            </View>
            <View style={[styles.desktopRail, { borderLeftColor: palette.border }]}>
              <FoodMarquee />
            </View>
          </View>
        ) : (
          <View style={[columnStyle, style]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * The branded "fill the gap instantly" loader: every screen's first paint
 * while it fetches its data, instead of a bare/blank flash. Pass `label` for
 * what's loading; omit for a quiet generic state.
 */
export function LoadingScreen({ label }: { label?: string }) {
  const palette = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three }}>
      <ActivityIndicator color={palette.accent} />
      {label && <Small color={palette.textSecondary}>{label}</Small>}
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

/**
 * Like `Reveal`, but the entrance plays the first time the element scrolls
 * into view rather than at mount — for long single-scroll pages (the
 * marketing site) where firing every section's animation at load time means
 * nothing visibly happens as the user actually scrolls down. Native has no
 * scroll-into-view signal for an arbitrary view, so it falls back to firing
 * immediately, same as `Reveal`.
 */
export function ScrollReveal({
  children,
  delay = 0,
  y = 22,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduced();
  const ref = useRef<View>(null);
  const p = useSharedValue(reduce || Platform.OS !== 'web' ? 1 : 0);

  useEffect(() => {
    if (reduce || Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return;
    const node = ref.current as unknown as Element | null;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          p.value = withDelay(delay, withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) }));
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay, p, reduce]);

  const animated = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * y }],
  }));

  // The outer View exists only to give IntersectionObserver a DOM node to
  // watch — `style` (which may carry layout-critical rules like a 3-column
  // row) goes on the inner Animated.View instead, so the real layout box has
  // exactly the same shape it would without this wrapper.
  return (
    <View ref={ref}>
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </View>
  );
}

/**
 * A short, quiet synthesized click (web only — native has no Web Audio API
 * and Hermes/expo-av would need a bundled sound asset). Lazily creates one
 * shared AudioContext rather than one per tap. Sound is always a nice-to-have:
 * any failure (autoplay policy, unsupported browser) is swallowed silently so
 * it can never break a tap.
 */
let tapAudioCtx: AudioContext | null = null;
function playTapSound() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!tapAudioCtx) tapAudioCtx = new Ctx();
    if (tapAudioCtx.state === 'suspended') void tapAudioCtx.resume();
    const ctx = tapAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // ignore — see comment above
  }
}

const SPARKLE_COUNT = 5;

/** A handful of tiny stars bursting outward from the tap point, then fading.
 * Self-removes via `onDone` once the animation has finished. */
function SparkleBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 520);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: SPARKLE_COUNT }).map((_, i) => (
        <SparkleParticle key={i} index={i} total={SPARKLE_COUNT} x={x} y={y} />
      ))}
    </View>
  );
}

function SparkleParticle({ index, total, x, y }: { index: number; total: number; x: number; y: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
  }, [progress]);
  const angle = (index / total) * Math.PI * 2 + (index % 2 === 0 ? 0.3 : -0.3);
  const distance = 16 + (index % 3) * 6;
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value },
      { scale: 0.6 + (1 - progress.value) * 0.6 },
    ],
  }));
  return (
    <Animated.Text style={[styles.sparkle, { left: x - 5, top: y - 5 }, animated]}>✦</Animated.Text>
  );
}

/** Tactile press: a soft spring scale-down, plus a sleek tap sound and a small
 * sparkle burst from the touch point. Wraps any tappable surface. */
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
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!reduce) s.value = withSpring(to, spring);
    playTapSound();
    if (!reduce) {
      const { locationX, locationY } = e.nativeEvent;
      setBurst({ id: Date.now(), x: locationX, y: locationY });
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={() => {
        s.value = withSpring(1, spring);
      }}
      style={[animated, style]}
    >
      {children}
      {burst && <SparkleBurst key={burst.id} x={burst.x} y={burst.y} onDone={() => setBurst(null)} />}
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
          // RN-web only renders a coherent box-shadow when shadowColor and the
          // other shadow* props share one style object — split across two
          // objects in the array, the dynamic one's missing fields default to
          // 0 and silently zero the shadow out. Keep them together here.
          primary
            ? {
                backgroundColor: palette.accent,
                shadowColor: palette.accent,
                shadowOpacity: 0.28,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 6,
              }
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

/** Circular avatar: the user's photo, or an initial on a tinted disc. */
export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  const palette = usePalette();
  const initial = (name || '?').charAt(0).toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: Type.displayBold, fontSize: size * 0.42, color: palette.accent }}>{initial}</Text>
    </View>
  );
}

/** Small verified-style checkmark for Pro members — sits inline next to a display name. */
export function ProBadge({ size = 15 }: { size?: number }) {
  const palette = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: Type.bodyBold, fontSize: size * 0.6, lineHeight: size * 0.7, color: palette.onAccent }}>✓</Text>
    </View>
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
  sparkle: { position: 'absolute', fontSize: 10, color: '#FFD166' },
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
