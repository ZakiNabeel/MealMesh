/**
 * ArticleMarquee — the "From the kitchen" website strip as a slow, endlessly
 * looping horizontal drift (mirrors CuisineMarquee's pattern, just driven by
 * a plain rAF loop instead of withRepeat so it can pause/resume mid-flight
 * without a jump). Hovering a card pauses the drift, pops that card up, and
 * softly dims + blurs its neighbors so the hovered one reads as the focus.
 */

import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FoodImage } from '@/components/FoodImage';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePalette, useReduced } from '@/theme/use-theme';

export type FeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  heroImage: string;
  heroImageAlt: string;
  readingTime: string;
  url: string;
};

export type PlaceholderArticle = { category: string; title: string; excerpt: string; query: string };

const CARD_W = 320;
const GAP = Spacing.three;
const PX_PER_SEC = 20; // slow, readable drift

// Smooth, web-only transitions for the hover pop/blur — RN has no concept of
// CSS transitions, but react-native-web passes unrecognised style keys
// straight through to the DOM, so this animates the plain style-prop swap.
const transition =
  Platform.OS === 'web'
    ? ({ transitionProperty: 'transform, opacity, filter', transitionDuration: '260ms', transitionTimingFunction: 'ease' } as unknown as ViewStyle)
    : null;

function cardHoverStyle(isThis: boolean, anyHovered: boolean): ViewStyle {
  if (!anyHovered) return { transform: [{ scale: 1 }], opacity: 1 };
  if (isThis) return { transform: [{ scale: 1.06 }], opacity: 1, zIndex: 2 };
  return {
    transform: [{ scale: 0.97 }],
    opacity: 0.55,
    ...(Platform.OS === 'web' ? ({ filter: 'blur(1.5px)' } as unknown as ViewStyle) : null),
  };
}

type Props = {
  liveArticles: FeedArticle[] | null;
  placeholders: PlaceholderArticle[];
  pad: number;
};

export function ArticleMarquee({ liveArticles, placeholders, pad }: Props) {
  const palette = usePalette();
  const reduce = useReduced();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const x = useSharedValue(0);
  const running = useRef(true);

  const count = liveArticles?.length ?? placeholders.length;
  const setWidth = count * (CARD_W + GAP);

  useEffect(() => {
    if (reduce || setWidth === 0) return;
    x.value = -setWidth;
    let raf: number;
    let last = globalThis.performance?.now() ?? Date.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (running.current) {
        // Increasing x slides the track right, so cards drift left-to-right —
        // entering at the left edge, exiting at the right.
        x.value += PX_PER_SEC * dt;
        if (x.value >= 0) x.value -= setWidth;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [setWidth, reduce, x]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onHoverIn = (i: number) => {
    setHoveredIdx(i);
    running.current = false;
  };
  const onHoverOut = () => {
    setHoveredIdx(null);
    running.current = true;
  };

  const anyHovered = hoveredIdx !== null;

  const renderLive = (a: FeedArticle, i: number) => (
    <Pressable
      key={`${a.slug}-${i}`}
      onPress={() => Linking.openURL(a.url)}
      onHoverIn={() => onHoverIn(i)}
      onHoverOut={onHoverOut}
      style={[styles.article, transition, { width: CARD_W, backgroundColor: palette.card, borderColor: palette.border }, cardHoverStyle(hoveredIdx === i, anyHovered)]}
    >
      <Image source={{ uri: a.heroImage }} alt={a.heroImageAlt} resizeMode="cover" style={styles.articleImg} />
      <View style={{ padding: Spacing.three, gap: 6 }}>
        <View style={styles.articleMeta}>
          <Text style={[styles.eyebrow, { color: palette.accent, fontSize: 11 }]}>{a.category.toUpperCase()}</Text>
          <Text style={{ fontFamily: Type.bodyMedium, fontSize: 10.5, color: palette.textSecondary }}>{a.readingTime}</Text>
        </View>
        <Text style={[styles.articleTitle, { color: palette.text }]}>{a.title}</Text>
        <Text style={[styles.cardBody, { color: palette.textSecondary }]} numberOfLines={2}>
          {a.excerpt}
        </Text>
      </View>
    </Pressable>
  );

  const renderPlaceholder = (a: PlaceholderArticle, i: number) => (
    <Pressable
      key={`${a.title}-${i}`}
      onHoverIn={() => onHoverIn(i)}
      onHoverOut={onHoverOut}
      style={[styles.article, transition, { width: CARD_W, backgroundColor: palette.card, borderColor: palette.border }, cardHoverStyle(hoveredIdx === i, anyHovered)]}
    >
      <FoodImage name={a.query} ingredients={[]} query={a.query} style={styles.articleImg} radius={0} emojiSize={40} />
      <View style={{ padding: Spacing.three, gap: 6 }}>
        <View style={styles.articleMeta}>
          <Text style={[styles.eyebrow, { color: palette.accent, fontSize: 11 }]}>{a.category}</Text>
          <View style={[styles.soonPill, { backgroundColor: palette.backgroundElement }]}>
            <Text style={{ fontFamily: Type.bodyMedium, fontSize: 10.5, color: palette.textSecondary }}>Coming soon</Text>
          </View>
        </View>
        <Text style={[styles.articleTitle, { color: palette.text }]}>{a.title}</Text>
        <Text style={[styles.cardBody, { color: palette.textSecondary }]} numberOfLines={2}>
          {a.excerpt}
        </Text>
      </View>
    </Pressable>
  );

  if (reduce || setWidth === 0) {
    return (
      <View style={[styles.staticRow, { paddingHorizontal: pad }]}>
        {liveArticles ? liveArticles.map(renderLive) : placeholders.map(renderPlaceholder)}
      </View>
    );
  }

  // Triple the set: the visible window only ever looks into the middle copy,
  // so the wraparound is never visible as a jump (same trick as CuisineMarquee).
  const tripledLive = liveArticles ? [...liveArticles, ...liveArticles, ...liveArticles] : null;
  const tripledPlaceholders = [...placeholders, ...placeholders, ...placeholders];

  return (
    <View style={styles.clip}>
      <Animated.View style={[styles.track, { gap: GAP, paddingLeft: pad }, animated]}>
        {tripledLive ? tripledLive.map(renderLive) : tripledPlaceholders.map(renderPlaceholder)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', width: '100%' },
  track: { flexDirection: 'row' },
  staticRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  article: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  articleImg: { width: '100%', height: 150 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soonPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  articleTitle: { fontFamily: Type.displayBold, fontSize: 16.5, lineHeight: 21 },
  eyebrow: { fontFamily: Type.bodySemibold, letterSpacing: 0.4 },
  cardBody: { fontFamily: Type.body, fontSize: 14.5, lineHeight: 22 },
});
